using HoYoMusic.Desktop.App.ViewModels;
using Microsoft.UI.Xaml.Controls;

namespace HoYoMusic.Desktop.App.Pages;

public sealed partial class TagsPage : Page
{
    public TagsPage() { InitializeComponent(); }

    private MainViewModel? VM => DataContext as MainViewModel;

    private void TagItem_Click(object s, ItemClickEventArgs e)
    {
        if (VM is not null && e.ClickedItem is MainViewModel.FacetItem f)
            VM.ApplyTagFacetCommand.Execute(f);
    }
}
