using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace HoYoMusic.Desktop.App.Pages;

public sealed partial class TrackDetailPage : Page
{
    public TrackDetailPage() { InitializeComponent(); }

    private void Back_Click(object s, RoutedEventArgs e)
    {
        if (Frame?.CanGoBack == true)
            Frame.GoBack();
    }
}
