namespace Helpdesk.Api.Models;

public class JwtSettings
{
    public string Issuer { get; set; } = "Helpdesk";
    public string Audience { get; set; } = "Helpdesk";
    public string Secret { get; set; } = "SuperSecretLocalDevKey123!";
    public int ExpiryMinutes { get; set; } = 480;
}
