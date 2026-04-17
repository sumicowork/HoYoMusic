using HoYoMusic.Desktop.App.Controls;
using HoYoMusic.Desktop.App.ViewModels;
using System.ComponentModel;
using Microsoft.UI;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using WinRT.Interop;
using Windows.Storage;
using Windows.UI;

namespace HoYoMusic.Desktop.App;

public sealed partial class MainWindow : Window
{
    private const string ThemeModeSettingKey = "theme_mode";
    private readonly DispatcherQueueTimer _progressTimer;
    private readonly DispatcherQueueTimer _downloadRefreshTimer;
    private readonly DispatcherQueueTimer _inboxPollTimer;
    private AppWindow? _appWindow;
    private bool _isScrubbingProgress;
    private double _lastNonZeroVolume = 70;

    private HoYoPlayerBar PlayerBarControl => PlayerBar;
    private MediaPlayerElement PlayerElement => PlayerBarControl.PlayerElement;
    private Slider VolumeSlider => PlayerBarControl.VolumeSlider;
    private Slider ProgressSlider => PlayerBarControl.ProgressSlider;
    private TextBlock CurrentTimeText => PlayerBarControl.CurrentTimeText;
    private TextBlock DurationText => PlayerBarControl.DurationText;
    private FontIcon PlayPauseIcon => PlayerBarControl.PlayPauseIcon;
    private Button PrevButton => PlayerBarControl.PrevButton;
    private Button PlayPauseButton => PlayerBarControl.PlayPauseButton;
    private Button NextButton => PlayerBarControl.NextButton;

    public MainWindow(MainViewModel viewModel)
    {
        ViewModel = viewModel;
        InitializeComponent();

        Title = "HoYoMusic Windows 客户端";
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(TitleBarControl.DragRegion);
        ConfigureTitleBar();

        RootGrid.DataContext = ViewModel;
        RootGrid.Loaded += MainWindow_OnLoaded;
        RootGrid.KeyDown += MainWindow_OnKeyDown;
        RootGrid.IsTabStop = true;

        ViewModel.PropertyChanged += ViewModel_OnPropertyChanged;
        ViewModel.PlayRequested += ViewModelOnPlayRequested;
        ViewModel.StopRequested += ViewModelOnStopRequested;

        HookPlayerBarEvents();
        MainContentControl.RefreshSectionState();

        _progressTimer = DispatcherQueue.CreateTimer();
        _progressTimer.Interval = TimeSpan.FromMilliseconds(250);
        _progressTimer.Tick += ProgressTimer_OnTick;

        _downloadRefreshTimer = DispatcherQueue.CreateTimer();
        _downloadRefreshTimer.Interval = TimeSpan.FromSeconds(1);
        _downloadRefreshTimer.Tick += DownloadRefreshTimer_OnTick;

        _inboxPollTimer = DispatcherQueue.CreateTimer();
        _inboxPollTimer.Interval = TimeSpan.FromSeconds(45);
        _inboxPollTimer.Tick += InboxPollTimer_OnTick;

        if (PlayerElement.MediaPlayer is not null)
        {
            PlayerElement.MediaPlayer.MediaEnded += MediaPlayer_OnMediaEnded;
            PlayerElement.MediaPlayer.PlaybackSession.PlaybackStateChanged += PlaybackSession_OnPlaybackStateChanged;
        }

        Closed += MainWindow_OnClosed;
    }

    public MainViewModel ViewModel { get; }

    private void HookPlayerBarEvents()
    {
        PrevButton.Click += PrevButton_OnClick;
        PlayPauseButton.Click += PlayPauseButton_OnClick;
        NextButton.Click += NextButton_OnClick;
        VolumeSlider.ValueChanged += VolumeSlider_OnValueChanged;
        ProgressSlider.ValueChanged += ProgressSlider_OnValueChanged;
        ProgressSlider.PointerPressed += ProgressSlider_OnPointerPressed;
        ProgressSlider.PointerReleased += ProgressSlider_OnPointerReleased;
    }

    private void UnhookPlayerBarEvents()
    {
        PrevButton.Click -= PrevButton_OnClick;
        PlayPauseButton.Click -= PlayPauseButton_OnClick;
        NextButton.Click -= NextButton_OnClick;
        VolumeSlider.ValueChanged -= VolumeSlider_OnValueChanged;
        ProgressSlider.ValueChanged -= ProgressSlider_OnValueChanged;
        ProgressSlider.PointerPressed -= ProgressSlider_OnPointerPressed;
        ProgressSlider.PointerReleased -= ProgressSlider_OnPointerReleased;
    }

    private void ConfigureTitleBar()
    {
        var hwnd = WindowNative.GetWindowHandle(this);
        var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
        _appWindow = AppWindow.GetFromWindowId(windowId);

        if (!AppWindowTitleBar.IsCustomizationSupported())
        {
            return;
        }

        var titleBar = _appWindow.TitleBar;
        titleBar.PreferredHeightOption = TitleBarHeightOption.Tall;
        titleBar.ButtonBackgroundColor = Colors.Transparent;
        titleBar.ButtonInactiveBackgroundColor = Colors.Transparent;
        titleBar.ButtonHoverBackgroundColor = Color.FromArgb(32, 79, 140, 255);
        titleBar.ButtonPressedBackgroundColor = Color.FromArgb(48, 79, 140, 255);
        titleBar.ButtonForegroundColor = Color.FromArgb(255, 40, 46, 66);
        titleBar.ButtonHoverForegroundColor = Color.FromArgb(255, 30, 36, 56);
        titleBar.ButtonPressedForegroundColor = Color.FromArgb(255, 24, 28, 48);
        titleBar.ButtonInactiveForegroundColor = Color.FromArgb(170, 40, 46, 66);

        _appWindow.Changed += AppWindow_OnChanged;
        UpdateTitleBarLayout();
    }

    private void AppWindow_OnChanged(AppWindow sender, AppWindowChangedEventArgs args)
    {
        if (args.DidSizeChange || args.DidPresenterChange)
        {
            DispatcherQueue.TryEnqueue(UpdateTitleBarLayout);
        }
    }

    private void UpdateTitleBarLayout()
    {
        if (_appWindow is null)
        {
            return;
        }

        var rightInset = Math.Max(16, _appWindow.TitleBar.RightInset + 12);
        var leftInset = Math.Max(16, _appWindow.TitleBar.LeftInset + 8);
        TitleBarControl.Margin = new Thickness(leftInset, 10, rightInset, 2);
    }

    private async void MainWindow_OnLoaded(object sender, RoutedEventArgs e)
    {
        RootGrid.Loaded -= MainWindow_OnLoaded;

        VolumeSlider.Minimum = 0;
        VolumeSlider.Maximum = 100;
        VolumeSlider.StepFrequency = 5;
        VolumeSlider.Value = 70;
        _lastNonZeroVolume = VolumeSlider.Value;

        ProgressSlider.Minimum = 0;
        ProgressSlider.Maximum = 100;
        ProgressSlider.Value = 0;

        if (PlayerElement.MediaPlayer is not null)
        {
            PlayerElement.MediaPlayer.Volume = VolumeSlider.Value / 100.0;
        }

        MainContentControl.RefreshSectionState();
        await ViewModel.InitializeCommand.ExecuteAsync(null);
        MainContentControl.RefreshSectionState();

        var savedTheme = TryGetLocalSettingString(ThemeModeSettingKey);
        if (!string.IsNullOrWhiteSpace(savedTheme))
        {
            ViewModel.ThemeMode = savedTheme;
        }

        ApplyThemeMode(ViewModel.ThemeMode);
        _progressTimer.Start();
        _downloadRefreshTimer.Start();
        _inboxPollTimer.Start();
    }

    private void MainWindow_OnClosed(object sender, WindowEventArgs args)
    {
        _progressTimer.Stop();
        _downloadRefreshTimer.Stop();
        _inboxPollTimer.Stop();

        if (PlayerElement.MediaPlayer is not null)
        {
            PlayerElement.MediaPlayer.MediaEnded -= MediaPlayer_OnMediaEnded;
            PlayerElement.MediaPlayer.PlaybackSession.PlaybackStateChanged -= PlaybackSession_OnPlaybackStateChanged;
        }

        UnhookPlayerBarEvents();

        ViewModel.PropertyChanged -= ViewModel_OnPropertyChanged;
        ViewModel.PlayRequested -= ViewModelOnPlayRequested;
        ViewModel.StopRequested -= ViewModelOnStopRequested;
        RootGrid.KeyDown -= MainWindow_OnKeyDown;

        if (_appWindow is not null)
        {
            _appWindow.Changed -= AppWindow_OnChanged;
        }

        Closed -= MainWindow_OnClosed;
    }

    private void ViewModel_OnPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(MainViewModel.SelectedSection) || e.PropertyName == nameof(MainViewModel.IsAdmin))
        {
            MainContentControl.RefreshSectionState();
        }

        if (e.PropertyName == nameof(MainViewModel.ThemeMode))
        {
            ApplyThemeMode(ViewModel.ThemeMode);
            TrySetLocalSetting(ThemeModeSettingKey, ViewModel.ThemeMode);
        }
    }

    private static string? TryGetLocalSettingString(string key)
    {
        try
        {
            return ApplicationData.Current.LocalSettings.Values[key] as string;
        }
        catch
        {
            return null;
        }
    }

    private static void TrySetLocalSetting(string key, object value)
    {
        try
        {
            ApplicationData.Current.LocalSettings.Values[key] = value;
        }
        catch
        {
            // Ignore settings persistence errors when running unpackaged.
        }
    }

    private void ApplyThemeMode(string mode)
    {
        RootGrid.RequestedTheme = string.Equals(mode, "dark", StringComparison.OrdinalIgnoreCase)
            ? ElementTheme.Dark
            : string.Equals(mode, "light", StringComparison.OrdinalIgnoreCase)
                ? ElementTheme.Light
                : ElementTheme.Default;
    }

    private void DownloadRefreshTimer_OnTick(object? sender, object e)
    {
        ViewModel.RefreshDownloadCenterCommand.Execute(null);
    }

    private async void InboxPollTimer_OnTick(object? sender, object e)
    {
        if (!ViewModel.IsAuthenticated)
        {
            return;
        }

        await ViewModel.RefreshInboxCommand.ExecuteAsync(null);
    }
}
