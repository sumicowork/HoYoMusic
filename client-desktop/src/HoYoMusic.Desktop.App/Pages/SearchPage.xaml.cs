using HoYoMusic.Desktop.App.ViewModels;
using HoYoMusic.Desktop.Core.Models;
using Microsoft.UI.Xaml.Controls;

namespace HoYoMusic.Desktop.App.Pages;

public sealed partial class SearchPage : Page
{
    private MainViewModel? VM => DataContext as MainViewModel;

    public SearchPage()
    {
        InitializeComponent();
    }

    private void TrackItem_Click(object s, ItemClickEventArgs e)
    {
        if (VM is not null && e.ClickedItem is TrackItem track)
            VM.PlayPublicTrackRowCommand.Execute(track);
    }
}
