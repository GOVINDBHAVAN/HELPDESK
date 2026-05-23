namespace Helpdesk.Api.Models;

public class StorageSettings
{
    public string Provider { get; set; } = "local";
    public string LocalPath { get; set; } = "uploads";
}
