using HoYoMusic.Desktop.App.ViewModels;
using HoYoMusic.Desktop.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace HoYoMusic.Desktop.App;

/// <summary>
/// Provides application-specific behavior to supplement the default Application class.
/// </summary>
public partial class App : Application
{
    private const string ApiBaseUrlEnvName = "HOYOMUSIC_API_BASE_URL";
    private const string StartupLogFileName = "HoYoMusic.Desktop.startup.log";
    private Window? _window;

    /// <summary>
    /// Initializes the singleton application object.  This is the first line of authored code
    /// executed, and as such is the logical equivalent of main() or WinMain().
    /// </summary>
    public App()
    {
        InitializeComponent();
        UnhandledException += OnUnhandledException;

        var services = new ServiceCollection();
        var apiBaseUrl = Environment.GetEnvironmentVariable(ApiBaseUrlEnvName);
        services.AddHoYoMusicInfrastructure(apiBaseUrl);
        services.AddSingleton<MainViewModel>();

        Services = services.BuildServiceProvider();
    }

    public static ServiceProvider Services { get; private set; } = null!;

    /// <summary>
    /// Invoked when the application is launched.
    /// </summary>
    /// <param name="args">Details about the launch request and process.</param>
    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        try
        {
            _window = new MainWindow(Services.GetRequiredService<MainViewModel>());
            _window.Activate();
        }
        catch (Exception ex)
        {
            LogStartupError("OnLaunched", ex);
            var fallback = new Window
            {
                Title = "HoYoMusic 启动失败",
                Content = new Border
                {
                    Padding = new Thickness(24),
                    Child = new StackPanel
                    {
                        Spacing = 10,
                        Children =
                        {
                            new TextBlock { Text = "客户端启动失败（XAML加载异常）", FontSize = 20 },
                            new TextBlock { Text = ex.Message, TextWrapping = TextWrapping.Wrap },
                            new TextBlock { Text = $"日志：{Path.Combine(Path.GetTempPath(), StartupLogFileName)}", TextWrapping = TextWrapping.Wrap },
                            new TextBlock { Text = "请将日志内容发给开发者以继续排查。", TextWrapping = TextWrapping.Wrap },
                        },
                    },
                },
            };
            _window = fallback;
            fallback.Activate();
        }
    }

    private void OnUnhandledException(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        LogStartupError("UnhandledException", e.Exception);
    }

    private static void LogStartupError(string stage, Exception exception)
    {
        try
        {
            var path = Path.Combine(Path.GetTempPath(), StartupLogFileName);
            var parseDetails = BuildExceptionDetails(exception);
            var lines = new[]
            {
                $"[{DateTimeOffset.Now:O}] stage={stage}",
                parseDetails,
                exception.ToString(),
                string.Empty,
            };
            File.AppendAllLines(path, lines);
        }
        catch
        {
            // Ignore logging failures during startup crash handling.
        }
    }

    private static string BuildExceptionDetails(Exception exception)
    {
        var details = new List<string>
        {
            $"type={exception.GetType().FullName}",
            $"message={exception.Message}",
            $"hresult=0x{exception.HResult:X8}",
        };

        var lineNumber = TryGetPropertyValue(exception, "LineNumber");
        var linePosition = TryGetPropertyValue(exception, "LinePosition");
        var sourceUri = TryGetPropertyValue(exception, "SourceUri");
        if (!string.IsNullOrWhiteSpace(lineNumber)) details.Add($"line={lineNumber}");
        if (!string.IsNullOrWhiteSpace(linePosition)) details.Add($"position={linePosition}");
        if (!string.IsNullOrWhiteSpace(sourceUri)) details.Add($"sourceUri={sourceUri}");

        if (exception.InnerException is not null)
        {
            details.Add($"innerType={exception.InnerException.GetType().FullName}");
            details.Add($"innerMessage={exception.InnerException.Message}");
            details.Add($"innerHresult=0x{exception.InnerException.HResult:X8}");
        }

        return string.Join("; ", details);
    }

    private static string? TryGetPropertyValue(Exception exception, string propertyName)
    {
        var property = exception.GetType().GetProperty(propertyName);
        return property?.GetValue(exception)?.ToString();
    }
}
