using HoYoMusic.Desktop.Core.Abstractions;
using Windows.Security.Credentials;

namespace HoYoMusic.Desktop.Infrastructure.Storage;

public sealed class WindowsCredentialTokenStore : ITokenStore
{
    private const string ResourceName = "HoYoMusic.Desktop";
    private const string UserName = "auth-token";

    public Task SaveTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var vault = new PasswordVault();
        ClearExisting(vault);
        vault.Add(new PasswordCredential(ResourceName, UserName, token));
        return Task.CompletedTask;
    }

    public Task<string?> GetTokenAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var vault = new PasswordVault();
        try
        {
            var credential = vault.Retrieve(ResourceName, UserName);
            credential.RetrievePassword();
            return Task.FromResult<string?>(credential.Password);
        }
        catch
        {
            return Task.FromResult<string?>(null);
        }
    }

    public Task ClearTokenAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var vault = new PasswordVault();
        ClearExisting(vault);
        return Task.CompletedTask;
    }

    private static void ClearExisting(PasswordVault vault)
    {
        try
        {
            var existing = vault.FindAllByResource(ResourceName);
            foreach (var credential in existing)
            {
                vault.Remove(credential);
            }
        }
        catch
        {
            // Ignore missing-resource errors.
        }
    }
}

