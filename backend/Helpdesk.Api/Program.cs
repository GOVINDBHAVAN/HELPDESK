using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Helpdesk.Api.Data;
using Helpdesk.Api.Entities;
using Helpdesk.Api.Models;
using Helpdesk.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://0.0.0.0:5000");

builder.Services.AddDbContext<HelpdeskDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var redisConnectionString = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(redisConnectionString));

builder.Services.Configure<StorageSettings>(builder.Configuration.GetSection("AttachmentStorage"));
builder.Services.AddSingleton<IStorageService, LocalStorageService>();

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = true;
})
    .AddEntityFrameworkStores<HelpdeskDbContext>()
    .AddDefaultTokenProviders();

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));

var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>() ?? new JwtSettings();
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = key,
        ClockSkew = TimeSpan.FromMinutes(1)
    };
});

builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HelpdeskDbContext>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

    db.Database.EnsureCreated();

    foreach (var role in new[] { "Admin", "Agent", "Student" })
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            await roleManager.CreateAsync(new IdentityRole(role));
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    version = "1.0",
    environment = app.Environment.EnvironmentName
}));

app.MapPost("/api/auth/register", async (RegisterRequest request, UserManager<ApplicationUser> userManager) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new { error = "Email and password are required." });
    }

    var user = new ApplicationUser
    {
        UserName = request.Email,
        Email = request.Email,
        DisplayName = request.DisplayName,
        EmailConfirmed = true
    };

    var result = await userManager.CreateAsync(user, request.Password);
    if (!result.Succeeded)
    {
        return Results.BadRequest(result.Errors.Select(e => e.Description));
    }

    await userManager.AddToRoleAsync(user, "Agent");
    return Results.Created($"/api/auth/register/{user.Id}", new { user.Id, user.Email });
}).AllowAnonymous();

app.MapPost("/api/auth/login", async (LoginRequest request, UserManager<ApplicationUser> userManager) =>
{
    var user = await userManager.FindByEmailAsync(request.Email);
    if (user is null)
    {
        return Results.Unauthorized();
    }

    var passwordValid = await userManager.CheckPasswordAsync(user, request.Password);
    if (!passwordValid)
    {
        return Results.Unauthorized();
    }

    var token = GenerateJwtToken(user, jwtSettings);
    return Results.Ok(new AuthResponse
    {
        Token = token,
        Email = user.Email ?? string.Empty,
        UserId = user.Id
    });
}).AllowAnonymous();

app.MapGet("/api/tickets", async (HelpdeskDbContext db) =>
{
    var tickets = await db.Tickets
        .OrderByDescending(t => t.CreatedAt)
        .Select(t => new TicketResponse
        {
            Id = t.Id,
            Subject = t.Subject,
            Description = t.Description,
            Status = t.Status,
            Priority = t.Priority,
            Category = t.Category,
            StudentEmail = t.StudentEmail,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt
        })
        .ToListAsync();

    return Results.Ok(tickets);
}).RequireAuthorization();

app.MapPost("/api/tickets", async (CreateTicketRequest request, HelpdeskDbContext db, ClaimsPrincipal user) =>
{
    var ticket = new Ticket
    {
        Subject = request.Subject,
        Description = request.Description,
        Priority = request.Priority,
        Category = request.Category,
        StudentEmail = request.StudentEmail,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
        CreatedById = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
    };

    db.Tickets.Add(ticket);
    await db.SaveChangesAsync();

    return Results.Created($"/api/tickets/{ticket.Id}", new TicketResponse
    {
        Id = ticket.Id,
        Subject = ticket.Subject,
        Description = ticket.Description,
        Status = ticket.Status,
        Priority = ticket.Priority,
        Category = ticket.Category,
        StudentEmail = ticket.StudentEmail,
        CreatedAt = ticket.CreatedAt,
        UpdatedAt = ticket.UpdatedAt
    });
}).RequireAuthorization();

app.Run();

string GenerateJwtToken(ApplicationUser user, JwtSettings settings)
{
    var claims = new List<Claim>
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id),
        new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
        new Claim(ClaimTypes.Name, user.UserName ?? string.Empty)
    };

    var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    var tokenDescriptor = new JwtSecurityToken(
        issuer: settings.Issuer,
        audience: settings.Audience,
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(settings.ExpiryMinutes),
        signingCredentials: credentials);

    return new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
}
