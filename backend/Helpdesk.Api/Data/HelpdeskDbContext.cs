using Helpdesk.Api.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Helpdesk.Api.Data;

public class HelpdeskDbContext : IdentityDbContext<ApplicationUser>
{
    public HelpdeskDbContext(DbContextOptions<HelpdeskDbContext> options)
        : base(options)
    {
    }

    public DbSet<Ticket> Tickets => Set<Ticket>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Ticket>(entity =>
        {
            entity.Property(t => t.Subject).IsRequired().HasMaxLength(250);
            entity.Property(t => t.Description).IsRequired();
            entity.Property(t => t.StudentEmail).IsRequired().HasMaxLength(320);
            entity.Property(t => t.CreatedAt).HasDefaultValueSql("now()");
            entity.Property(t => t.UpdatedAt).HasDefaultValueSql("now()");
        });
    }
}
