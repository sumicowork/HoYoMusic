using System.ComponentModel;
using HoYoMusic.Desktop.App.Pages;
using HoYoMusic.Desktop.App.ViewModels;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace HoYoMusic.Desktop.App.Controls;

public sealed partial class HoYoMainContent : UserControl
{
    private MainViewModel? _boundViewModel;
    private bool _isNavigatingProgrammatically;

    public HoYoMainContent()
    {
        InitializeComponent();
        ContentFrame.Navigated += OnContentFrameNavigated;
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(DataContext as MainViewModel);
        NavigateToSection(_boundViewModel?.SelectedSection ?? "discover");
    }

    private void OnUnloaded(object sender, RoutedEventArgs e) => AttachViewModel(null);

    private void OnDataContextChanged(FrameworkElement sender, DataContextChangedEventArgs args)
    {
        AttachViewModel(args.NewValue as MainViewModel);
        NavigateToSection(_boundViewModel?.SelectedSection ?? "discover");
    }

    private void AttachViewModel(MainViewModel? vm)
    {
        if (_boundViewModel is not null) _boundViewModel.PropertyChanged -= OnVmPropertyChanged;
        _boundViewModel = vm;
        if (_boundViewModel is not null) _boundViewModel.PropertyChanged += OnVmPropertyChanged;
    }

    private void OnVmPropertyChanged(object? s, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(MainViewModel.SelectedSection) || e.PropertyName == nameof(MainViewModel.IsAdmin))
            NavigateToSection(_boundViewModel?.SelectedSection ?? "discover");
    }

    /// <summary>
    /// Syncs ViewModel.SelectedSection when the Frame navigates on its own (e.g. via GoBack()).
    /// This keeps the sidebar highlight and section title in sync with what's actually displayed.
    /// </summary>
    private void OnContentFrameNavigated(object sender, NavigationEventArgs e)
    {
        if (_isNavigatingProgrammatically) return;
        if (_boundViewModel is null) return;

        var section = PageTypeToSection(e.SourcePageType);
        if (section is null) return;

        // Suppress the PropertyChanged → NavigateToSection feedback loop
        _isNavigatingProgrammatically = true;
        try
        {
            if (_boundViewModel.SelectedSection != section)
            {
                _boundViewModel.SelectedSection = section;
                _boundViewModel.SelectedSectionIndex = SectionToIndex(section);
            }
        }
        finally
        {
            _isNavigatingProgrammatically = false;
        }
    }

    public void RefreshSectionState() => NavigateToSection(_boundViewModel?.SelectedSection ?? "discover");
    private MainViewModel? VM => _boundViewModel ?? DataContext as MainViewModel;

    private void NavigateToSection(string section)
    {
        if (VM is null) return;

        // Admin stays inline
        var isAdmin = section == "admin" && VM.IsAdmin;
        AdminViewPanel.Visibility = isAdmin ? Visibility.Visible : Visibility.Collapsed;
        ContentFrame.Visibility = isAdmin ? Visibility.Collapsed : Visibility.Visible;

        if (isAdmin) return;

        // Map section to page type
        var pageType = SectionToPageType(section);

        // Only navigate if the current page is different (avoid redundant navigation)
        if (ContentFrame.CurrentSourcePageType != pageType)
        {
            _isNavigatingProgrammatically = true;
            try
            {
                ContentFrame.Navigate(pageType);
            }
            finally
            {
                _isNavigatingProgrammatically = false;
            }
        }
    }

    private static Type SectionToPageType(string section) => section switch
    {
        "discover" => typeof(DiscoverPage),
        "games" => typeof(GamesPage),
        "albums" => typeof(AlbumsPage),
        "artists" => typeof(ArtistsPage),
        "tags" => typeof(TagsPage),
        "album-detail" => typeof(AlbumDetailPage),
        "track-detail" => typeof(TrackDetailPage),
        "library" => typeof(LibraryPage),
        "favorites" => typeof(FavoritesPage),
        "playlists" => typeof(PlaylistsPage),
        "profile" => typeof(ProfilePage),
        "search" => typeof(SearchPage),
        "settings" => typeof(SettingsPage),
        "downloads" => typeof(DownloadsPage),
        _ => typeof(DiscoverPage),
    };

    private static string? PageTypeToSection(Type pageType)
    {
        if (pageType == typeof(DiscoverPage)) return "discover";
        if (pageType == typeof(GamesPage)) return "games";
        if (pageType == typeof(AlbumsPage)) return "albums";
        if (pageType == typeof(ArtistsPage)) return "artists";
        if (pageType == typeof(TagsPage)) return "tags";
        if (pageType == typeof(AlbumDetailPage)) return "album-detail";
        if (pageType == typeof(TrackDetailPage)) return "track-detail";
        if (pageType == typeof(LibraryPage)) return "library";
        if (pageType == typeof(FavoritesPage)) return "favorites";
        if (pageType == typeof(PlaylistsPage)) return "playlists";
        if (pageType == typeof(ProfilePage)) return "profile";
        if (pageType == typeof(SearchPage)) return "search";
        if (pageType == typeof(SettingsPage)) return "settings";
        if (pageType == typeof(DownloadsPage)) return "downloads";
        return null;
    }

    private static int SectionToIndex(string section) => section switch
    {
        "discover" or "album-detail" or "track-detail" => 0,
        "games" => 1,
        "albums" => 2,
        "artists" => 3,
        "tags" => 4,
        "search" => 5,
        "library" => 6,
        "favorites" => 7,
        "playlists" => 8,
        "profile" => 9,
        "settings" => 10,
        "downloads" => 11,
        "admin" => 12,
        _ => 0,
    };

    // Keep minimal event handlers for admin inline content
    private void SuccessInfoBar_OnClose(InfoBar sender, object args) => VM?.DismissSuccessCommand.Execute(null);
}
