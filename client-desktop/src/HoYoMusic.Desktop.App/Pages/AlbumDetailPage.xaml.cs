using HoYoMusic.Desktop.App.ViewModels;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace HoYoMusic.Desktop.App.Pages;

public sealed partial class AlbumDetailPage : Page
{
    public AlbumDetailPage() { InitializeComponent(); }

    private MainViewModel? VM => DataContext as MainViewModel;

    private void Back_Click(object s, RoutedEventArgs e)
    {
        if (Frame?.CanGoBack == true)
            Frame.GoBack();
    }

    private void TrackItem_Click(object s, ItemClickEventArgs e)
    {
        if (VM is not null && e.ClickedItem is MainViewModel.AlbumTrackRow row)
            VM.PlayAlbumTrackRowCommand.Execute(row);
    }
}
