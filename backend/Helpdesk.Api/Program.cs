using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Helpdesk.Api.Data;
using Helpdesk.Api.Entities;
using Helpdesk.Api.Filters;
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
    options
        .UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
        .UseSnakeCaseNamingConvention());

var redisConnectionString = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(redisConnectionString));

builder.Services.Configure<StorageSettings>(builder.Configuration.GetSection("AttachmentStorage"));
builder.Services.AddSingleton<IStorageService, LocalStorageService>();

builder.Services.Configure<WebhookSettings>(builder.Configuration.GetSection("WebhookSettings"));
builder.Services.AddScoped<WebhookSecretFilter>();

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

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HelpdeskDbContext>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

    db.Database.EnsureCreated();

    foreach (var role in Enum.GetNames<UserRole>())
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));
    }

    var adminEmail = builder.Configuration["Seed:AdminEmail"]
        ?? throw new InvalidOperationException("Seed:AdminEmail is not configured.");
    var adminPassword = builder.Configuration["Seed:AdminPassword"]
        ?? throw new InvalidOperationException("Seed:AdminPassword is not configured.");

    if (await userManager.FindByEmailAsync(adminEmail) is null)
    {
        var adminUser = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            DisplayName = "Admin",
            EmailConfirmed = true
        };
        var result = await userManager.CreateAsync(adminUser, adminPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException(
                $"Failed to seed admin user: {string.Join(", ", result.Errors.Select(e => e.Description))}");

        await userManager.AddToRoleAsync(adminUser, nameof(UserRole.Admin));
    }

    var agentEmail = builder.Configuration["Seed:AgentEmail"]
        ?? throw new InvalidOperationException("Seed:AgentEmail is not configured.");
    var agentPassword = builder.Configuration["Seed:AgentPassword"]
        ?? throw new InvalidOperationException("Seed:AgentPassword is not configured.");

    if (await userManager.FindByEmailAsync(agentEmail) is null)
    {
        var agentUser = new ApplicationUser
        {
            UserName = agentEmail,
            Email = agentEmail,
            DisplayName = "Agent",
            EmailConfirmed = true
        };
        var result = await userManager.CreateAsync(agentUser, agentPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException(
                $"Failed to seed agent user: {string.Join(", ", result.Errors.Select(e => e.Description))}");

        await userManager.AddToRoleAsync(agentUser, nameof(UserRole.Agent));
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

    await userManager.AddToRoleAsync(user, nameof(UserRole.Agent));
    return Results.Created($"/api/auth/register/{user.Id}", new { user.Id, user.Email });
}).RequireAuthorization(policy => policy.RequireRole(nameof(UserRole.Admin)));

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

    var roles = await userManager.GetRolesAsync(user);
    var token = GenerateJwtToken(user, roles, jwtSettings);
    return Results.Ok(new AuthResponse
    {
        Token = token,
        Email = user.Email ?? string.Empty,
        UserId = user.Id
    });
}).AllowAnonymous();

app.MapGet("/api/me", (ClaimsPrincipal principal, HttpContext httpContext) =>
{
    var userId = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
    var email = principal.FindFirstValue(JwtRegisteredClaimNames.Email);
    var token = httpContext.Request.Headers.Authorization.ToString().Replace("Bearer ", "");

    return Results.Ok(new
    {
        UserId = userId,
        Email = email,
        Token = token
    });
}).RequireAuthorization();

app.MapGet("/api/tickets", async (HelpdeskDbContext db, string? sortBy, string? sortDir, int? page, int? pageSize) =>
{
    var descending = !string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);
    var currentPage = page is > 0 ? page.Value : 1;
    var currentPageSize = pageSize is > 0 and <= 100 ? pageSize.Value : 10;

    var totalCount = await db.Tickets.CountAsync();

    IQueryable<Ticket> sortedTickets = sortBy?.ToLowerInvariant() switch
    {
        "subject" => descending ? db.Tickets.OrderByDescending(t => t.Subject) : db.Tickets.OrderBy(t => t.Subject),
        "studentemail" => descending ? db.Tickets.OrderByDescending(t => t.StudentEmail) : db.Tickets.OrderBy(t => t.StudentEmail),
        "status" => descending ? db.Tickets.OrderByDescending(t => t.Status) : db.Tickets.OrderBy(t => t.Status),
        "priority" => descending ? db.Tickets.OrderByDescending(t => t.Priority) : db.Tickets.OrderBy(t => t.Priority),
        "category" => descending ? db.Tickets.OrderByDescending(t => t.Category) : db.Tickets.OrderBy(t => t.Category),
        _ => descending ? db.Tickets.OrderByDescending(t => t.CreatedAt) : db.Tickets.OrderBy(t => t.CreatedAt),
    };

    var tickets = await sortedTickets
        .Skip((currentPage - 1) * currentPageSize)
        .Take(currentPageSize)
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

    return Results.Ok(new PagedTicketsResponse
    {
        Items = tickets,
        TotalCount = totalCount,
        Page = currentPage,
        PageSize = currentPageSize
    });
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

app.MapPost("/api/tickets/from-email", async (IncomingEmailRequest request, HelpdeskDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.FromEmail) || string.IsNullOrWhiteSpace(request.Subject))
    {
        return Results.BadRequest(new { error = "FromEmail and Subject are required." });
    }

    var normalizedSubject = NormalizeSubject(request.Subject);

    var existingTicket = await db.Tickets
        .Where(t => t.StudentEmail == request.FromEmail && t.Status != TicketStatus.Closed)
        .ToListAsync();
    var matchingTicket = existingTicket
        .FirstOrDefault(t => NormalizeSubject(t.Subject) == normalizedSubject);

    if (matchingTicket is not null)
    {
        matchingTicket.Description += $"\n\n---\n{DateTime.UtcNow:u}\n{request.Body}";
        matchingTicket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Results.Ok(new TicketResponse
        {
            Id = matchingTicket.Id,
            Subject = matchingTicket.Subject,
            Description = matchingTicket.Description,
            Status = matchingTicket.Status,
            Priority = matchingTicket.Priority,
            Category = matchingTicket.Category,
            StudentEmail = matchingTicket.StudentEmail,
            CreatedAt = matchingTicket.CreatedAt,
            UpdatedAt = matchingTicket.UpdatedAt
        });
    }

    var ticket = new Ticket
    {
        Subject = request.Subject,
        Description = request.Body,
        Priority = TicketPriority.Medium,
        Category = TicketCategory.General,
        StudentEmail = request.FromEmail,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
        CreatedById = null
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
}).AllowAnonymous().AddEndpointFilter<WebhookSecretFilter>();

app.MapGet("/api/users", async (UserManager<ApplicationUser> userManager) =>
{
    var users = userManager.Users.OrderBy(u => u.Email).ToList();
    var result = new List<UserResponse>();
    foreach (var user in users)
    {
        var roles = await userManager.GetRolesAsync(user);
        result.Add(new UserResponse
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName ?? string.Empty,
            Role = roles.FirstOrDefault() ?? string.Empty
        });
    }
    return Results.Ok(result);
}).RequireAuthorization(policy => policy.RequireRole(nameof(UserRole.Admin)));

app.MapDelete("/api/users/{id}", async (string id, UserManager<ApplicationUser> userManager) =>
{
    var user = await userManager.FindByIdAsync(id);
    if (user is null)
    {
        return Results.NotFound();
    }

    var roles = await userManager.GetRolesAsync(user);
    if (roles.Contains(nameof(UserRole.Admin)))
    {
        return Results.BadRequest(new { error = "Admin users cannot be deleted." });
    }

    user.IsDeleted = true;
    user.DeletedAt = DateTime.UtcNow;
    await userManager.UpdateAsync(user);

    return Results.NoContent();
}).RequireAuthorization(policy => policy.RequireRole(nameof(UserRole.Admin)));

app.Run();

string NormalizeSubject(string subject)
{
    var stripped = Regex.Replace(subject, @"^\s*(re|fwd?)\s*:\s*", string.Empty, RegexOptions.IgnoreCase);
    return stripped.Trim().ToLowerInvariant();
}

string GenerateJwtToken(ApplicationUser user, IList<string> roles, JwtSettings settings)
{
    var claims = new List<Claim>
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id),
        new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
        new Claim(ClaimTypes.Name, user.UserName ?? string.Empty)
    };

    foreach (var role in roles)
        claims.Add(new Claim("role", role));

    var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    var tokenDescriptor = new JwtSecurityToken(
        issuer: settings.Issuer,
        audience: settings.Audience,
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(settings.ExpiryMinutes),
        signingCredentials: credentials);

    return new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
}
