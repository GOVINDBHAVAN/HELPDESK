using System.Security.Cryptography;
using System.Text;
using Helpdesk.Api.Models;
using Microsoft.Extensions.Options;

namespace Helpdesk.Api.Filters;

public class WebhookSecretFilter(IOptions<WebhookSettings> webhookSettings) : IEndpointFilter
{
    private const string HeaderName = "X-Webhook-Secret";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var expectedSecret = webhookSettings.Value.InboundEmailSecret;
        if (string.IsNullOrEmpty(expectedSecret))
        {
            return Results.Problem("Webhook secret is not configured.", statusCode: StatusCodes.Status500InternalServerError);
        }

        var providedSecret = context.HttpContext.Request.Headers[HeaderName].ToString();
        if (string.IsNullOrEmpty(providedSecret) || !FixedTimeEquals(providedSecret, expectedSecret))
        {
            return Results.Unauthorized();
        }

        return await next(context);
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        var aBytes = Encoding.UTF8.GetBytes(a);
        var bBytes = Encoding.UTF8.GetBytes(b);

        if (aBytes.Length != bBytes.Length)
        {
            CryptographicOperations.FixedTimeEquals(aBytes, aBytes);
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }
}
