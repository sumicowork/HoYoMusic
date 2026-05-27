using System.ComponentModel;
using System.Linq;
using HoYoMusic.Desktop.App.ViewModels;
using HoYoMusic.Desktop.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;

namespace HoYoMusic.Desktop.App.Controls;

public sealed partial class HoYoMainContent : UserControl
{
    private MainViewModel? _boundViewModel;

    public HoYoMainContent()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(DataContext as MainViewModel);
        UpdateContentViews();
    }
    private void OnUnloaded(object sender, RoutedEventArgs e) => AttachViewModel(null);
    private void OnDataContextChanged(FrameworkElement sender, DataContextChangedEventArgs args)
    {
        AttachViewModel(args.NewValue as MainViewModel);
        UpdateContentViews();
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
            UpdateContentViews();
    }
    public void RefreshSectionState() => UpdateContentViews();
    private MainViewModel? VM => _boundViewModel ?? DataContext as MainViewModel;

    private void UpdateContentViews()
    {
        if (VM is null) return;
        var section = VM.SelectedSection;
        var isBrowse = section is "discover" or "games" or "albums" or "artists" or "tags" or "album-detail" or "track-detail";
        var isLibrary = section is "library" or "favorites" or "playlists" or "profile";
        var isSearch = section is "search";
        SetVis(BrowseViewPanel, isBrowse);
        SetVis(LibraryViewPanel, isLibrary);
        SetVis(SearchViewPanel, isSearch);
        // sub-views
        SetVis(DiscoverContent, section == "discover");
        SetVis(GamesContent, section == "games");
        SetVis(AlbumsContent, section == "albums");
        SetVis(ArtistsContent, section == "artists");
        SetVis(TagsContent, section == "tags");
        SetVis(AlbumDetailContent, section == "album-detail");
        SetVis(TrackDetailContent, section == "track-detail");
        SetVis(LibraryTabContent, section == "library");
        SetVis(FavoritesTabContent, section == "favorites");
        SetVis(PlaylistsTabContent, section == "playlists");
        SetVis(ProfileTabContent, section == "profile");
        // Other sections (admin, settings, downloads)
        SetVis(AdminViewPanel, section == "admin" && VM.IsAdmin);
        SetVis(SettingsViewPanel, section == "settings");
        SetVis(DownloadsViewPanel, section == "downloads");
    }

    private static void SetVis(UIElement el, bool visible) { if (el is not null) el.Visibility = visible ? Visibility.Visible : Visibility.Collapsed; }

    // Nav
    private void BrowseNav_Click(object s, RoutedEventArgs e) => VM?.OpenSectionCommand.Execute("discover");
    private void LibraryNav_Click(object s, RoutedEventArgs e) => VM?.OpenSectionCommand.Execute("library");
    private void SearchNav_Click(object s, RoutedEventArgs e) => VM?.OpenSectionCommand.Execute("search");
    private void SubNav_Click(object s, RoutedEventArgs e) { if (s is Button b && b.Tag is string tag) VM?.OpenSectionCommand.Execute(tag); }
    private void MoreMenu_Click(object s, RoutedEventArgs e) { if (s is MenuFlyoutItem i && i.Tag is string tag) VM?.OpenSectionCommand.Execute(tag); }
    private void SuccessInfoBar_OnClose(InfoBar sender, object args) => VM?.DismissSuccessCommand.Execute(null);
    private void DiscoverAlbumsList_OnItemClick(object s, ItemClickEventArgs e) { if (VM is not null && e.ClickedItem is GameAlbumItem a) VM.OpenAlbumDetailCommand.Execute(a); }
    private void AlbumTrackList_OnItemClick(object s, ItemClickEventArgs e) { if (VM is not null && e.ClickedItem is MainViewModel.AlbumTrackRow r) VM.PlayAlbumTrackRowCommand.Execute(r); }
}
