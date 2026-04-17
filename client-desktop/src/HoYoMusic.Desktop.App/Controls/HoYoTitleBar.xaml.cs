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

    private async void LoginButton_OnClick(object sender, RoutedEventArgs e)
    {
        if (ViewModel is not null)
        {
            await ViewModel.LoginCommand.ExecuteAsync(null);
        }
    }

    private async void InboxFilter_OnToggled(object sender, RoutedEventArgs e)
    {
        if (ViewModel is not null)
        {
            await ViewModel.RefreshInboxCommand.ExecuteAsync(null);
        }
    }

    private void PasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (ViewModel is not null && sender is PasswordBox box)
        {
            ViewModel.Password = box.Password;
        }
    }

    private void CurrentPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (ViewModel is not null && sender is PasswordBox box)
        {
            ViewModel.CurrentPassword = box.Password;
        }
    }

    private void NewPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (ViewModel is not null && sender is PasswordBox box)
        {
            ViewModel.NewPassword = box.Password;
        }
    }

    private void RegisterPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (ViewModel is not null && sender is PasswordBox box)
        {
            ViewModel.RegisterPassword = box.Password;
        }
    }

    private void RegisterConfirmPasswordInput_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (ViewModel is not null && sender is PasswordBox box)
        {
            ViewModel.RegisterConfirmPassword = box.Password;
        }
    }
}
