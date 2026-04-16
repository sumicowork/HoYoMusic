using HoYoMusic.Desktop.App.ViewModels;
using System.ComponentModel;
using Microsoft.UI;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Input;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using WinRT.Interop;
using Windows.UI;
using Windows.Storage;
using Windows.Media.Core;
using Windows.UI.Core;

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

    public MainWindow(MainViewModel viewModel)
    {
        ViewModel = viewModel;
        InitializeComponent();

        Title = "HoYoMusic Windows 客户端";
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);
        ConfigureTitleBar();

        RootGrid.DataContext = ViewModel;
        RootGrid.Loaded += MainWindow_OnLoaded;
        RootGrid.KeyDown += MainWindow_OnKeyDown;
        RootGrid.IsTabStop = true;
        ViewModel.PropertyChanged += ViewModel_OnPropertyChanged;
        ViewModel.PlayRequested += ViewModelOnPlayRequested;
        ViewModel.StopRequested += ViewModelOnStopRequested;

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
    }

    public MainViewModel ViewModel { get; }

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
        AppTitleBar.Margin = new Thickness(leftInset, 10, rightInset, 2);
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

        UpdateSectionVisibility();
        await ViewModel.InitializeCommand.ExecuteAsync(null);
        UpdateSectionVisibility();
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

    private void ViewModel_OnPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(MainViewModel.SelectedSection))
        {
            UpdateSectionVisibility();
        }

        if (e.PropertyName == nameof(MainViewModel.IsAdmin))
        {
            UpdateSectionVisibility();
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

    private void UpdateSectionVisibility()
    {
        DiscoverSectionPanel.Visibility = ViewModel.IsDiscoverSection ? Visibility.Visible : Visibility.Collapsed;
        AlbumDetailSectionPanel.Visibility = ViewModel.IsAlbumDetailSection ? Visibility.Visible : Visibility.Collapsed;
        GamesSectionPanel.Visibility = ViewModel.IsGamesSection ? Visibility.Visible : Visibility.Collapsed;
        AlbumsSectionPanel.Visibility = ViewModel.IsAlbumsSection ? Visibility.Visible : Visibility.Collapsed;
        ArtistsSectionPanel.Visibility = ViewModel.IsArtistsSection ? Visibility.Visible : Visibility.Collapsed;
        TagsSectionPanel.Visibility = ViewModel.IsTagsSection ? Visibility.Visible : Visibility.Collapsed;
        SearchSectionPanel.Visibility = ViewModel.IsSearchSection ? Visibility.Visible : Visibility.Collapsed;
        LibrarySectionPanel.Visibility = ViewModel.IsLibrarySection ? Visibility.Visible : Visibility.Collapsed;
        FavoritesSectionPanel.Visibility = ViewModel.IsFavoritesSection ? Visibility.Visible : Visibility.Collapsed;
        PlaylistsSectionPanel.Visibility = ViewModel.IsPlaylistsSection ? Visibility.Visible : Visibility.Collapsed;
        ProfileSectionPanel.Visibility = ViewModel.IsProfileSection ? Visibility.Visible : Visibility.Collapsed;
        SettingsSectionPanel.Visibility = ViewModel.IsSettingsSection ? Visibility.Visible : Visibility.Collapsed;
        DownloadsSectionPanel.Visibility = ViewModel.IsDownloadsSection ? Visibility.Visible : Visibility.Collapsed;
        AdminSectionPanel.Visibility = ViewModel.ShowAdminEntry && ViewModel.IsAdminSection ? Visibility.Visible : Visibility.Collapsed;
        UpdateSectionNavVisualState();
    }

    private void UpdateSectionNavVisualState()
    {
        ApplySectionButtonStyle(DiscoverNavButton, ViewModel.IsDiscoverSection || ViewModel.IsAlbumDetailSection);
        ApplySectionButtonStyle(GamesNavButton, ViewModel.IsGamesSection);
        ApplySectionButtonStyle(AlbumsNavButton, ViewModel.IsAlbumsSection);
        ApplySectionButtonStyle(ArtistsNavButton, ViewModel.IsArtistsSection);
        ApplySectionButtonStyle(TagsNavButton, ViewModel.IsTagsSection);
        ApplySectionButtonStyle(SearchNavButton, ViewModel.IsSearchSection);
        ApplySectionButtonStyle(LibraryNavButton, ViewModel.IsLibrarySection);
        ApplySectionButtonStyle(FavoritesNavButton, ViewModel.IsFavoritesSection);
        ApplySectionButtonStyle(PlaylistsNavButton, ViewModel.IsPlaylistsSection);
        ApplySectionButtonStyle(ProfileNavButton, ViewModel.IsProfileSection);
        ApplySectionButtonStyle(SettingsNavButton, ViewModel.IsSettingsSection);
        ApplySectionButtonStyle(DownloadsNavButton, ViewModel.IsDownloadsSection);
        ApplySectionButtonStyle(AdminNavButton, ViewModel.IsAdminSection);
    }

    private void ApplySectionButtonStyle(Button button, bool isActive)
    {
        var styleKey = isActive ? "PrimaryButtonStyle" : "SecondaryButtonStyle";
        if (Application.Current.Resources.TryGetValue(styleKey, out var style) && style is Style resolvedStyle)
        {
            button.Style = resolvedStyle;
        }
    }

    private async void LoginButton_OnClick(object sender, RoutedEventArgs e)
    {
        await ViewModel.LoginCommand.ExecuteAsync(null);
    }

    private async void InboxFilter_OnToggled(object sender, RoutedEventArgs e)
    {
        await ViewModel.RefreshInboxCommand.ExecuteAsync(null);
    }

    private void SuccessInfoBar_OnClose(InfoBar sender, object args)
    {
        ViewModel.DismissSuccessCommand.Execute(null);
    }

    private void PasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        ViewModel.Password = ((PasswordBox)sender).Password;
    }

    private void CurrentPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        ViewModel.CurrentPassword = ((PasswordBox)sender).Password;
    }

    private void NewPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        ViewModel.NewPassword = ((PasswordBox)sender).Password;
    }

    private void RegisterPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        ViewModel.RegisterPassword = ((PasswordBox)sender).Password;
    }

    private void RegisterConfirmPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        ViewModel.RegisterConfirmPassword = ((PasswordBox)sender).Password;
    }

    private void ViewModelOnPlayRequested(object? sender, Uri streamUri)
    {
        try
        {
            PlayerElement.Source = MediaSource.CreateFromUri(streamUri);
            PlayerElement.MediaPlayer.Play();
            UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState.Playing);
        }
        catch (Exception ex)
        {
            ViewModel.ErrorMessage = $"播放错误：{ex.Message}";
        }
    }

    private void ViewModelOnStopRequested(object? sender, EventArgs e)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is null)
        {
            return;
        }

        mediaPlayer.Pause();
        PlayerElement.Source = null;
        UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState.Paused);
        CurrentTimeText.Text = "0:00";
        DurationText.Text = "0:00";
    }

    private void PrevButton_OnClick(object sender, RoutedEventArgs e)
    {
        ViewModel.PlayPreviousCommand.Execute(null);
    }

    private void PlayPauseButton_OnClick(object sender, RoutedEventArgs e)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is null)
        {
            return;
        }

        if (mediaPlayer.PlaybackSession.PlaybackState == Windows.Media.Playback.MediaPlaybackState.Playing)
        {
            mediaPlayer.Pause();
            UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState.Paused);
        }
        else
        {
            mediaPlayer.Play();
            UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState.Playing);
        }
    }

    private void NextButton_OnClick(object sender, RoutedEventArgs e)
    {
        ViewModel.PlayNextCommand.Execute(null);
    }

    private void VolumeSlider_OnValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (PlayerElement.MediaPlayer is not null)
        {
            PlayerElement.MediaPlayer.Volume = e.NewValue / 100.0;
        }

        if (e.NewValue > 0)
        {
            _lastNonZeroVolume = e.NewValue;
        }
    }

    private void MainWindow_OnKeyDown(object sender, KeyRoutedEventArgs e)
    {
        switch (e.Key)
        {
            case Windows.System.VirtualKey.Space:
                PlayPauseButton_OnClick(sender, new RoutedEventArgs());
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Left:
                if (IsControlPressed())
                {
                    SeekBySeconds(-5);
                }
                else
                {
                    PrevButton_OnClick(sender, new RoutedEventArgs());
                }
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Right:
                if (IsControlPressed())
                {
                    SeekBySeconds(5);
                }
                else
                {
                    NextButton_OnClick(sender, new RoutedEventArgs());
                }
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Up:
                VolumeSlider.Value = Math.Min(100, VolumeSlider.Value + 5);
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Down:
                VolumeSlider.Value = Math.Max(0, VolumeSlider.Value - 5);
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.M:
                if (Math.Abs(VolumeSlider.Value) < 0.01)
                {
                    VolumeSlider.Value = Math.Max(10, _lastNonZeroVolume);
                }
                else
                {
                    _lastNonZeroVolume = VolumeSlider.Value;
                    VolumeSlider.Value = 0;
                }
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.L:
                ViewModel.TogglePlayModeCommand.Execute(null);
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Escape:
                if (ViewModel.IsAlbumDetailSection)
                {
                    ViewModel.BackToDiscoverCommand.Execute(null);
                    e.Handled = true;
                }
                break;
        }
    }

    private void MediaPlayer_OnMediaEnded(Windows.Media.Playback.MediaPlayer sender, object args)
    {
        DispatcherQueue.TryEnqueue(() => ViewModel.HandleTrackEndedCommand.Execute(null));
    }

    private void PlaybackSession_OnPlaybackStateChanged(Windows.Media.Playback.MediaPlaybackSession sender, object args)
    {
        DispatcherQueue.TryEnqueue(() => UpdatePlayPauseGlyph(sender.PlaybackState));
    }

    private void UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState playbackState)
    {
        if (PlayPauseIcon is null)
        {
            return;
        }

        PlayPauseIcon.Glyph = playbackState == Windows.Media.Playback.MediaPlaybackState.Playing ? "\uE769" : "\uE768";
    }

    private void ProgressTimer_OnTick(object? sender, object e)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is null)
        {
            return;
        }

        var session = mediaPlayer.PlaybackSession;
        var duration = session.NaturalDuration;
        if (duration.TotalSeconds > 0)
        {
            ProgressSlider.Maximum = duration.TotalSeconds;
            DurationText.Text = FormatTime(duration);
        }
        else
        {
        }

        if (_isScrubbingProgress)
        {
            return;
        }

        var position = session.Position;
        if (position.TotalSeconds >= 0)
        {
            if (ViewModel.IsAbLoopEnabled && ViewModel.AbLoopEndSeconds > ViewModel.AbLoopStartSeconds)
            {
                var loopStart = Math.Max(0, ViewModel.AbLoopStartSeconds);
                var loopEnd = Math.Max(loopStart + 1, ViewModel.AbLoopEndSeconds);
                if (position.TotalSeconds >= loopEnd)
                {
                    mediaPlayer.PlaybackSession.Position = TimeSpan.FromSeconds(loopStart);
                    position = mediaPlayer.PlaybackSession.Position;
                }
            }

            ProgressSlider.Value = Math.Min(ProgressSlider.Maximum, position.TotalSeconds);
            CurrentTimeText.Text = FormatTime(position);
            ViewModel.NotifyPlaybackProgress(position.TotalSeconds, duration.TotalSeconds > 0 ? duration.TotalSeconds : null);
        }
    }

    private void ProgressSlider_OnPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        _isScrubbingProgress = true;
    }

    private void ProgressSlider_OnPointerReleased(object sender, PointerRoutedEventArgs e)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is not null)
        {
            mediaPlayer.PlaybackSession.Position = TimeSpan.FromSeconds(Math.Max(0, ProgressSlider.Value));
        }

        _isScrubbingProgress = false;
    }

    private void ProgressSlider_OnValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (e.NewValue >= 0)
        {
            CurrentTimeText.Text = FormatTime(TimeSpan.FromSeconds(e.NewValue));
        }
    }

    private static string FormatTime(TimeSpan value)
    {
        if (value.TotalHours >= 1)
        {
            return value.ToString("h\\:mm\\:ss");
        }

        return value.ToString("m\\:ss");
    }

    private static bool IsControlPressed()
    {
        var state = InputKeyboardSource.GetKeyStateForCurrentThread(Windows.System.VirtualKey.Control);
        return state.HasFlag(CoreVirtualKeyStates.Down);
    }

    private void SeekBySeconds(double deltaSeconds)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is null)
        {
            return;
        }

        var session = mediaPlayer.PlaybackSession;
        var next = session.Position + TimeSpan.FromSeconds(deltaSeconds);
        if (next < TimeSpan.Zero)
        {
            next = TimeSpan.Zero;
        }

        if (session.NaturalDuration.TotalSeconds > 0 && next > session.NaturalDuration)
        {
            next = session.NaturalDuration;
        }

        session.Position = next;
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

    private void GameCoverImage_OnImageFailed(object sender, ExceptionRoutedEventArgs e)
    {
        if (sender is Image image)
        {
            // Set opacity to indicate it's missing but avoid Layout collapsing completely
            image.Opacity = 0.2;
        }
    }

    private void GameCoverImage_OnImageOpened(object sender, RoutedEventArgs e)
    {
        if (sender is Image image)
        {
            // Recycled item containers must restore image visibility on successful load.
            image.Visibility = Visibility.Visible;
        }
    }

    private async void DiscoverAlbumsList_OnItemClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is HoYoMusic.Desktop.Core.Models.GameAlbumItem album)
        {
            await ViewModel.OpenAlbumDetailCommand.ExecuteAsync(album);
        }
    }

    private void AlbumTrackList_OnItemClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is MainViewModel.AlbumTrackRow row)
        {
            ViewModel.PlayAlbumTrackRowCommand.Execute(row);
        }
    }

    private void AlbumCard_OnPointerEntered(object sender, PointerRoutedEventArgs e)
    {
        if (sender is not Grid grid)
        {
            return;
        }

        if (grid.RenderTransform is ScaleTransform scale)
        {
            scale.ScaleX = 1.03;
            scale.ScaleY = 1.03;
        }

        foreach (var child in grid.Children.OfType<Border>())
        {
            if (child.Name == "AlbumPlayOverlay")
            {
                child.Opacity = 1;
                break;
            }
        }
    }

    private void AlbumCard_OnPointerExited(object sender, PointerRoutedEventArgs e)
    {
        if (sender is not Grid grid)
        {
            return;
        }

        if (grid.RenderTransform is ScaleTransform scale)
        {
            scale.ScaleX = 1;
            scale.ScaleY = 1;
        }

        foreach (var child in grid.Children.OfType<Border>())
        {
            if (child.Name == "AlbumPlayOverlay")
            {
                child.Opacity = 0;
                break;
            }
        }
    }
}
