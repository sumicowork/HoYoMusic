using System.ComponentModel;
using HoYoMusic.Desktop.App.ViewModels;
using Microsoft.UI;
using Microsoft.UI.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace HoYoMusic.Desktop.App.Controls;

public sealed partial class HoYoSideBar : UserControl
{
    public static readonly DependencyProperty IsCompactProperty = DependencyProperty.Register(
        nameof(IsCompact),
        typeof(bool),
        typeof(HoYoSideBar),
        new PropertyMetadata(false, OnIsCompactChanged));

    private MainViewModel? _boundViewModel;

    public HoYoSideBar()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;
        UpdateCompactState();
    }

    public bool IsCompact
    {
        get => (bool)GetValue(IsCompactProperty);
        set => SetValue(IsCompactProperty, value);
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(DataContext as MainViewModel);
        HighlightActiveSection();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e) => AttachViewModel(null);

    private void OnDataContextChanged(FrameworkElement sender, DataContextChangedEventArgs args)
    {
        AttachViewModel(args.NewValue as MainViewModel);
        HighlightActiveSection();
    }

    private void AttachViewModel(MainViewModel? vm)
    {
        if (_boundViewModel is not null) _boundViewModel.PropertyChanged -= OnVmPropertyChanged;
        _boundViewModel = vm;
        if (_boundViewModel is not null) _boundViewModel.PropertyChanged += OnVmPropertyChanged;
    }

    private void OnVmPropertyChanged(object? s, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(MainViewModel.SelectedSection))
        {
            HighlightActiveSection();
        }
    }

    private static void OnIsCompactChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is HoYoSideBar sideBar)
        {
            sideBar.UpdateCompactState();
        }
    }

    private void UpdateCompactState()
    {
        var vis = IsCompact ? Visibility.Collapsed : Visibility.Visible;
        DiscoverLabel.Visibility = vis;
        LibraryLabel.Visibility = vis;
        SearchLabel.Visibility = vis;
        BrowseLabel.Visibility = vis;
        DiscoverSubLabel.Visibility = vis;
        GamesSubLabel.Visibility = vis;
        AlbumsSubLabel.Visibility = vis;
        ArtistsSubLabel.Visibility = vis;
        TagsSubLabel.Visibility = vis;
        GamesHeaderLabel.Visibility = vis;
        FavoritesLabel.Visibility = vis;
        PlaylistsLabel.Visibility = vis;
        DownloadsLabel.Visibility = vis;
        SettingsLabel.Visibility = vis;
        AdminLabel.Visibility = vis;
    }

    private void NavButton_OnClick(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is string tag && _boundViewModel is not null)
        {
            _boundViewModel.OpenSectionCommand.Execute(tag);
        }
    }

    private void HighlightActiveSection()
    {
        if (_boundViewModel is null) return;
        var section = _boundViewModel.SelectedSection;

        HighlightButton(DiscoverButton, section is "discover" or "album-detail" or "track-detail");
        HighlightButton(LibraryButton, section is "library" or "favorites" or "playlists" or "profile");
        HighlightButton(SearchButton, section == "search");
    }

    private static void HighlightButton(Button button, bool isActive)
    {
        button.FontWeight = isActive ? FontWeights.SemiBold : FontWeights.Normal;
        if (isActive)
        {
            button.Background = Application.Current.Resources["SidebarSelectedBrush"] as Brush;
        }
        else
        {
            button.Background = new SolidColorBrush(Colors.Transparent);
        }
    }

    private void GameCoverImage_OnImageFailed(object sender, ExceptionRoutedEventArgs e)
    {
        if (sender is Image image)
        {
            image.Opacity = 0.2;
        }
    }

    private void GameCoverImage_OnImageOpened(object sender, RoutedEventArgs e)
    {
        if (sender is Image image)
        {
            image.Opacity = 1;
            image.Visibility = Visibility.Visible;
        }
    }
}
