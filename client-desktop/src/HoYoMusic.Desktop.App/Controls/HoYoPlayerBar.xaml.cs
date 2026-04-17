using Microsoft.UI.Xaml.Controls;
namespace HoYoMusic.Desktop.App.Controls;
public sealed partial class HoYoPlayerBar : UserControl
{
    public HoYoPlayerBar()
    {
        InitializeComponent();
    }

    public Slider ProgressSlider => ProgressSliderControl;
    public Slider VolumeSlider => VolumeSliderControl;
    public TextBlock CurrentTimeText => CurrentTimeTextControl;
    public TextBlock DurationText => DurationTextControl;
    public FontIcon PlayPauseIcon => PlayPauseIconControl;
    public Button PrevButton => PrevButtonControl;
    public Button PlayPauseButton => PlayPauseButtonControl;
    public Button NextButton => NextButtonControl;
    public MediaPlayerElement PlayerElement => PlayerElementControl;
}
