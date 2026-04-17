using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace HoYoMusic.Desktop.App.Controls;

public sealed partial class HoYoSideBar : UserControl
{
    public static readonly DependencyProperty IsCompactProperty = DependencyProperty.Register(
        nameof(IsCompact),
        typeof(bool),
        typeof(HoYoSideBar),
        new PropertyMetadata(false, OnIsCompactChanged));

    public HoYoSideBar()
    {
        InitializeComponent();
        UpdateCompactState();
    }

    public bool IsCompact
    {
        get => (bool)GetValue(IsCompactProperty);
        set => SetValue(IsCompactProperty, value);
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
        SideBarText.Visibility = IsCompact ? Visibility.Collapsed : Visibility.Visible;
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
