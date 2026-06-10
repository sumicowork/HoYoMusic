using HoYoMusic.Desktop.App.ViewModels;
using HoYoMusic.Desktop.Core.Models;
using Microsoft.UI.Xaml.Controls;

namespace HoYoMusic.Desktop.App.Pages;

public sealed partial class DiscoverPage : Page
{
    public DiscoverPage() { InitializeComponent(); }

    private MainViewModel? VM => DataContext as MainViewModel;

    private void AlbumItem_Click(object s, ItemClickEventArgs e)
    {
        if (VM is not null && e.ClickedItem is GameAlbumItem a)
            VM.OpenAlbumDetailCommand.Execute(a);
    }

    private void RandomTrack_Click(object s, ItemClickEventArgs e)
    {
        if (VM is not null && e.ClickedItem is PublicTrackItem t)
            VM.PlayRandomTrackCommand.Execute(t);
    }

    private void TopTrack_Click(object s, ItemClickEventArgs e)
    {
        if (VM is not null && e.ClickedItem is PublicTrackItem t)
            VM.PlayTopTrackCommand.Execute(t);
    }
}
