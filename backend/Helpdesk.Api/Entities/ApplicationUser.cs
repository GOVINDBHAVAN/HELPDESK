using Microsoft.AspNetCore.Identity;

namespace Helpdesk.Api.Entities;

public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
