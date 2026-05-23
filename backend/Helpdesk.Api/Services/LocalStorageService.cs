using Helpdesk.Api.Models;
using Microsoft.Extensions.Options;

namespace Helpdesk.Api.Services;

public class LocalStorageService : IStorageService
{
    private readonly string _basePath;

    public LocalStorageService(IOptions<StorageSettings> options)
    {
        _basePath = options.Value.LocalPath;
        Directory.CreateDirectory(_basePath);
    }

    public async Task<string> SaveAsync(Stream content, string fileName, string contentType)
    {
        var safeFileName = Path.GetFileName(fileName);
        var key = $"{Guid.NewGuid():N}_{safeFileName}";
        var filePath = Path.Combine(_basePath, key);

        await using var fileStream = File.Create(filePath);
        await content.CopyToAsync(fileStream);

        return key;
    }

    public Task DeleteAsync(string fileKey)
    {
        var filePath = Path.Combine(_basePath, fileKey);
        if (File.Exists(filePath))
            File.Delete(filePath);

        return Task.CompletedTask;
    }

    public string GetUrl(string fileKey) => $"/api/attachments/{fileKey}";
}
