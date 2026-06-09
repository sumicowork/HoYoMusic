using HoYoMusic.Desktop.App.Controls;
using HoYoMusic.Desktop.App.ViewModels;
using System.ComponentModel;
using Microsoft.UI;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using WinRT.Interop;
using Windows.Storage;
using Windows.UI;

namespace HoYoMusic.Desktop.App;

public sealed partial class MainWindow : Window
{
    private const string ThemeModeSettingKey = "settings_theme_mode";
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
        titleBar.ButtonHoverBackgroundColor = Color.FromArgb(32, 0x63, 0x66, 0xF1);
        titleBar.ButtonPressedBackgroundColor = Color.FromArgb(48, 0x55, 0x58, 0xE6);
        titleBar.ButtonForegroundColor = Color.FromArgb(255, 0x52, 0x52, 0x5B);
        titleBar.ButtonHoverForegroundColor = Color.FromArgb(255, 0x18, 0x18, 0x1B);
        titleBar.ButtonPressedForegroundColor = Color.FromArgb(255, 0x52, 0x52, 0x5B);
        titleBar.ButtonInactiveForegroundColor = Color.FromArgb(0xFF, 0x71, 0x71, 0x7A);

        _appWindow.Changed += AppWindow_OnChanged;
        UpdateTitleBarLayout();
    }

    private void AppWindow_OnChanged(AppWindow sender, AppWindowChangedEventArgs args)
    {
        if (args.DidSizeChange || args.DidPresenterChange)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                UpdateTitleBarLayout();
                UpdateSidebarWidth();
            });
        }
    }

    private void UpdateSidebarWidth()
    {
        var width = _appWindow?.Size.Width ?? 0;
        if (width >= 1400)
        {
            SideBarColumn.Width = new GridLength(260);
            LeftSideBar.IsCompact = false;
        }
        else if (width >= 1000)
        {
            SideBarColumn.Width = new GridLength(220);
            LeftSideBar.IsCompact = false;
        }
        else
        {
            SideBarColumn.Width = new GridLength(64);
            LeftSideBar.IsCompact = true;
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

        UpdateSidebarWidth();

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

        if (e.PropertyName == nameof(MainViewModel.ActiveDrawerPanel))
        {
            UpdateDrawerTitle();
        }
    }

    private void UpdateDrawerTitle()
    {
        DrawerTitleText.Text = ViewModel.ActiveDrawerPanel switch
        {
            MainViewModel.DrawerQueue => "播放队列",
            MainViewModel.DrawerNowPlaying => "正在播放",
            MainViewModel.DrawerEnhancements => "播放器增强",
            MainViewModel.DrawerAccount => "账户中心",
            MainViewModel.DrawerInbox => "收件箱",
            _ => string.Empty,
        };
    }

    // ─── Drawer password box event handlers ───
    private void DrawerPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (sender is PasswordBox pb) ViewModel.Password = pb.Password;
    }

    private async void DrawerLoginButton_OnClick(object sender, RoutedEventArgs e)
    {
        await ViewModel.LoginCommand.ExecuteAsync(null);
    }

    private void DrawerRegisterPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (sender is PasswordBox pb) ViewModel.RegisterPassword = pb.Password;
    }

    private void DrawerRegisterConfirmPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (sender is PasswordBox pb) ViewModel.RegisterConfirmPassword = pb.Password;
    }

    private void DrawerCurrentPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (sender is PasswordBox pb) ViewModel.CurrentPassword = pb.Password;
    }

    private void DrawerNewPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (sender is PasswordBox pb) ViewModel.NewPassword = pb.Password;
    }

    private async void DrawerInboxFilter_OnToggled(object sender, RoutedEventArgs e)
    {
        await ViewModel.RefreshInboxCommand.ExecuteAsync(null);
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
        var isDark = string.Equals(mode, "dark", StringComparison.OrdinalIgnoreCase);
        RootGrid.RequestedTheme = isDark ? ElementTheme.Dark
            : string.Equals(mode, "light", StringComparison.OrdinalIgnoreCase) ? ElementTheme.Light
            : ElementTheme.Default;

        if (RootGrid.RequestedTheme == ElementTheme.Default && Application.Current.RequestedTheme == ApplicationTheme.Dark)
        {
            isDark = true;
        }

        ApplyBrushTheme(isDark);
        ApplyTitleBarTheme(isDark);
    }

    private static void ApplyBrushTheme(bool isDark)
    {
        var r = App.Current.Resources;

        if (isDark)
        {
            SetBrush(r, "PrimaryBrush", 0xFF, 0x81, 0x8C, 0xF8);
            SetBrush(r, "PrimaryHoverBrush", 0xFF, 0x63, 0x66, 0xF1);
            SetBrush(r, "PrimarySubtleBrush", 0xFF, 0x2D, 0x2B, 0x60);
            SetBrush(r, "AccentBrush", 0xFF, 0xF5, 0x9E, 0x42);
            SetBrush(r, "SurfaceBrush", 0xFF, 0x11, 0x11, 0x18);
            SetBrush(r, "SurfaceCardBrush", 0xFF, 0x20, 0x20, 0x30);
            SetBrush(r, "SurfaceAltBrush", 0xFF, 0x28, 0x28, 0x3E);
            SetBrush(r, "TextPrimaryBrush", 0xFF, 0xF4, 0xF4, 0xF5);
            SetBrush(r, "TextSecondaryBrush", 0xFF, 0xB4, 0xB4, 0xBE);
            SetBrush(r, "TextTertiaryBrush", 0xFF, 0xA1, 0xA1, 0xAA);
            SetBrush(r, "TextInverseBrush", 0xFF, 0x18, 0x18, 0x1B);
            SetBrush(r, "ErrorBrush", 0xFF, 0xF8, 0x71, 0x71);
            SetBrush(r, "SuccessBrush", 0xFF, 0x4A, 0xDE, 0x80);
            SetBrush(r, "SpectrumBarBrush", 0x99, 0x81, 0x8C, 0xF8);
            SetBrush(r, "InputBackgroundBrush", 0x18, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "InputBorderBrush", 0x80, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "SecondaryFillBrush", 0x20, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "CardBorderBrush", 0x60, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "SubtleCardBorderBrush", 0x40, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "PlayerSurfaceBrush", 0xFF, 0x1C, 0x1C, 0x32);
            SetBrush(r, "GlassCardBrush", 0xFF, 0x22, 0x22, 0x38);
            SetBrush(r, "GlassSubtleBrush", 0xFF, 0x28, 0x28, 0x42);
            SetBrush(r, "GlassStrongBrush", 0xFF, 0x26, 0x26, 0x3C);
            SetBrush(r, "ModalOverlayBrush", 0x88, 0x00, 0x00, 0x00);
            SetBrush(r, "SidebarSelectedBrush", 0x40, 0x81, 0x8C, 0xF8);
            SetBrush(r, "SidebarHoverBrush", 0x20, 0x81, 0x8C, 0xF8);

            SetGradient(r, "PrimaryGradientBrush", 0xFF, 0x81, 0x8C, 0xF8, 0xFF, 0xA5, 0xB4, 0xFC);
            SetGradient3(r, "AppBackgroundBrush", 0xFF, 0x14, 0x14, 0x1C, 0xFF, 0x12, 0x12, 0x1A, 0xFF, 0x14, 0x14, 0x1C);
        }
        else
        {
            SetBrush(r, "PrimaryBrush", 0xFF, 0x63, 0x66, 0xF1);
            SetBrush(r, "PrimaryHoverBrush", 0xFF, 0x55, 0x58, 0xE6);
            SetBrush(r, "PrimarySubtleBrush", 0xFF, 0xEE, 0xF0, 0xFF);
            SetBrush(r, "AccentBrush", 0xFF, 0xF5, 0x9E, 0x42);
            SetBrush(r, "SurfaceBrush", 0xFF, 0xFB, 0xFB, 0xFE);
            SetBrush(r, "SurfaceCardBrush", 0xFF, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "SurfaceAltBrush", 0xFF, 0xF5, 0xF5, 0xFA);
            SetBrush(r, "TextPrimaryBrush", 0xFF, 0x18, 0x18, 0x1B);
            SetBrush(r, "TextSecondaryBrush", 0xFF, 0x52, 0x52, 0x5B);
            SetBrush(r, "TextTertiaryBrush", 0xFF, 0x71, 0x71, 0x7A);
            SetBrush(r, "TextInverseBrush", 0xFF, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "ErrorBrush", 0xFF, 0xEF, 0x44, 0x44);
            SetBrush(r, "SuccessBrush", 0xFF, 0x22, 0xC5, 0x5E);
            SetBrush(r, "SpectrumBarBrush", 0x99, 0x63, 0x66, 0xF1);
            SetBrush(r, "InputBackgroundBrush", 0x06, 0x00, 0x00, 0x00);
            SetBrush(r, "InputBorderBrush", 0x10, 0x00, 0x00, 0x00);
            SetBrush(r, "SecondaryFillBrush", 0x08, 0x00, 0x00, 0x00);
            SetBrush(r, "CardBorderBrush", 0x0C, 0x00, 0x00, 0x00);
            SetBrush(r, "SubtleCardBorderBrush", 0x04, 0x00, 0x00, 0x00);
            SetBrush(r, "PlayerSurfaceBrush", 0xF9, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "GlassCardBrush", 0xF2, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "GlassSubtleBrush", 0xD9, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "GlassStrongBrush", 0xFF, 0xFF, 0xFF, 0xFF);
            SetBrush(r, "ModalOverlayBrush", 0x88, 0x00, 0x00, 0x00);
            SetBrush(r, "SidebarSelectedBrush", 0x14, 0x63, 0x66, 0xF1);
            SetBrush(r, "SidebarHoverBrush", 0x08, 0x63, 0x66, 0xF1);

            SetGradient(r, "PrimaryGradientBrush", 0xFF, 0x63, 0x66, 0xF1, 0xFF, 0x81, 0x8C, 0xF8);
            SetGradient3(r, "AppBackgroundBrush", 0xFF, 0xF5, 0xF3, 0xFF, 0xFF, 0xEE, 0xF2, 0xFF, 0xFF, 0xF5, 0xF0, 0xFF);
        }
    }

    private static void SetBrush(ResourceDictionary r, string key, byte a, byte rr, byte g, byte b)
    {
        if (r[key] is SolidColorBrush brush)
        {
            brush.Color = Color.FromArgb(a, rr, g, b);
        }
    }

    private static void SetGradient(ResourceDictionary r, string key, byte a1, byte r1, byte g1, byte b1, byte a2, byte r2, byte g2, byte b2)
    {
        if (r[key] is LinearGradientBrush gradient && gradient.GradientStops.Count >= 2)
        {
            gradient.GradientStops[0].Color = Color.FromArgb(a1, r1, g1, b1);
            gradient.GradientStops[1].Color = Color.FromArgb(a2, r2, g2, b2);
        }
    }

    private static void SetGradient3(ResourceDictionary r, string key, byte a1, byte r1, byte g1, byte b1, byte a2, byte r2, byte g2, byte b2, byte a3, byte r3, byte g3, byte b3)
    {
        if (r[key] is LinearGradientBrush gradient && gradient.GradientStops.Count >= 3)
        {
            gradient.GradientStops[0].Color = Color.FromArgb(a1, r1, g1, b1);
            gradient.GradientStops[1].Color = Color.FromArgb(a2, r2, g2, b2);
            gradient.GradientStops[2].Color = Color.FromArgb(a3, r3, g3, b3);
        }
    }

    private void ApplyTitleBarTheme(bool isDark)
    {
        if (_appWindow is null || !AppWindowTitleBar.IsCustomizationSupported())
        {
            return;
        }

        var titleBar = _appWindow.TitleBar;
        titleBar.ButtonBackgroundColor = Colors.Transparent;
        titleBar.ButtonInactiveBackgroundColor = Colors.Transparent;

        if (isDark)
        {
            titleBar.ButtonHoverBackgroundColor = Color.FromArgb(32, 0x81, 0x8C, 0xF8);
            titleBar.ButtonPressedBackgroundColor = Color.FromArgb(48, 0x63, 0x66, 0xF1);
            titleBar.ButtonForegroundColor = Color.FromArgb(255, 0xA1, 0xA1, 0xAA);
            titleBar.ButtonHoverForegroundColor = Color.FromArgb(255, 0xF4, 0xF4, 0xF5);
            titleBar.ButtonPressedForegroundColor = Color.FromArgb(255, 0xA1, 0xA1, 0xAA);
            titleBar.ButtonInactiveForegroundColor = Color.FromArgb(0xFF, 0xA1, 0xA1, 0xAA);
        }
        else
        {
            titleBar.ButtonHoverBackgroundColor = Color.FromArgb(32, 0x63, 0x66, 0xF1);
            titleBar.ButtonPressedBackgroundColor = Color.FromArgb(48, 0x55, 0x58, 0xE6);
            titleBar.ButtonForegroundColor = Color.FromArgb(255, 0x52, 0x52, 0x5B);
            titleBar.ButtonHoverForegroundColor = Color.FromArgb(255, 0x18, 0x18, 0x1B);
            titleBar.ButtonPressedForegroundColor = Color.FromArgb(255, 0x52, 0x52, 0x5B);
            titleBar.ButtonInactiveForegroundColor = Color.FromArgb(0xFF, 0x71, 0x71, 0x7A);
        }
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
