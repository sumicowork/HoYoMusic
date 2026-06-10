using HoYoMusic.Desktop.App.ViewModels;
using HoYoMusic.Desktop.Core.Models;
using Microsoft.UI.Xaml.Controls;

namespace HoYoMusic.Desktop.App.Pages;

public sealed partial class AlbumsPage : Page
{
    public AlbumsPage() { InitializeComponent(); }

    private MainViewModel? VM => DataContext as MainViewModel;

    private void AlbumItem_Click(object s, ItemClickEventArgs e)
    {
        if (VM is not null && e.ClickedItem is GameAlbumItem a)
            VM.OpenAlbumDetailCommand.Execute(a);
    }
}
