namespace Helpdesk.Api.Services;

public interface IStorageService
{
    Task<string> SaveAsync(Stream content, string fileName, string contentType);
    Task DeleteAsync(string fileKey);
    string GetUrl(string fileKey);
}
