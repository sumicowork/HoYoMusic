using HoYoMusic.Desktop.App.ViewModels;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace HoYoMusic.Desktop.App.Controls;

public sealed partial class HoYoTitleBar : UserControl
{
    public HoYoTitleBar()
    {
        InitializeComponent();
    }

    public FrameworkElement DragRegion => TitleBarRoot;

    private MainViewModel? ViewModel => DataContext as MainViewModel;
}
