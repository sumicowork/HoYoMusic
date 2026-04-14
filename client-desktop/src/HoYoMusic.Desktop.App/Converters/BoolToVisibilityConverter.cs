namespace HoYoMusic.Desktop.App.Converters;

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Data;

public sealed class BoolToVisibilityConverter : IValueConverter
{
	public object Convert(object value, Type targetType, object parameter, string language)
	{
		var flag = value is bool b && b;
		var invert = parameter is string p && p.Equals("invert", StringComparison.OrdinalIgnoreCase);
		if (invert)
		{
			flag = !flag;
		}

		return flag ? Visibility.Visible : Visibility.Collapsed;
	}

	public object ConvertBack(object value, Type targetType, object parameter, string language)
	{
		if (value is Visibility visibility)
		{
			return visibility == Visibility.Visible;
		}

		return false;
	}
}


