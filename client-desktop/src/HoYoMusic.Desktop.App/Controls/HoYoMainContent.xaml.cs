using System.ComponentModel;
using System.Linq;
using HoYoMusic.Desktop.App.ViewModels;
using HoYoMusic.Desktop.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;

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
        UpdateSectionVisibility();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(null);
    }

    private void OnDataContextChanged(FrameworkElement sender, DataContextChangedEventArgs args)
    {
        AttachViewModel(args.NewValue as MainViewModel);
        UpdateSectionVisibility();
    }

    private void AttachViewModel(MainViewModel? viewModel)
    {
        if (_boundViewModel is not null)
        {
            _boundViewModel.PropertyChanged -= ViewModelOnPropertyChanged;
        }

        _boundViewModel = viewModel;

        if (_boundViewModel is not null)
        {
            _boundViewModel.PropertyChanged += ViewModelOnPropertyChanged;
        }
    }

    private void ViewModelOnPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(MainViewModel.SelectedSection) || e.PropertyName == nameof(MainViewModel.IsAdmin))
        {
            UpdateSectionVisibility();
        }
    }

    public void RefreshSectionState() => UpdateSectionVisibility();

    private MainViewModel? ViewModel => _boundViewModel ?? DataContext as MainViewModel;

    private void UpdateSectionVisibility()
    {
        if (ViewModel is null)
        {
            return;
        }

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

        UpdateSectionNavVisualState(ViewModel);
    }

    private void UpdateSectionNavVisualState(MainViewModel viewModel)
    {
        ApplySectionButtonStyle(DiscoverNavButton, viewModel.IsDiscoverSection || viewModel.IsAlbumDetailSection);
        ApplySectionButtonStyle(GamesNavButton, viewModel.IsGamesSection);
        ApplySectionButtonStyle(AlbumsNavButton, viewModel.IsAlbumsSection);
        ApplySectionButtonStyle(ArtistsNavButton, viewModel.IsArtistsSection);
        ApplySectionButtonStyle(TagsNavButton, viewModel.IsTagsSection);
        ApplySectionButtonStyle(SearchNavButton, viewModel.IsSearchSection);
        ApplySectionButtonStyle(LibraryNavButton, viewModel.IsLibrarySection);
        ApplySectionButtonStyle(FavoritesNavButton, viewModel.IsFavoritesSection);
        ApplySectionButtonStyle(PlaylistsNavButton, viewModel.IsPlaylistsSection);
        ApplySectionButtonStyle(ProfileNavButton, viewModel.IsProfileSection);
        ApplySectionButtonStyle(SettingsNavButton, viewModel.IsSettingsSection);
        ApplySectionButtonStyle(DownloadsNavButton, viewModel.IsDownloadsSection);
        ApplySectionButtonStyle(AdminNavButton, viewModel.IsAdminSection);
    }

    private static void ApplySectionButtonStyle(Button button, bool isActive)
    {
        var styleKey = isActive ? "PrimaryButtonStyle" : "SecondaryButtonStyle";
        if (Application.Current.Resources.TryGetValue(styleKey, out var style) && style is Style resolvedStyle)
        {
            button.Style = resolvedStyle;
        }
    }

    private void SuccessInfoBar_OnClose(InfoBar sender, object args)
    {
        ViewModel?.DismissSuccessCommand.Execute(null);
    }

    private async void DiscoverAlbumsList_OnItemClick(object sender, ItemClickEventArgs e)
    {
        if (ViewModel is not null && e.ClickedItem is GameAlbumItem album)
        {
            await ViewModel.OpenAlbumDetailCommand.ExecuteAsync(album);
        }
    }

    private void AlbumTrackList_OnItemClick(object sender, ItemClickEventArgs e)
    {
        if (ViewModel is not null && e.ClickedItem is MainViewModel.AlbumTrackRow row)
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
