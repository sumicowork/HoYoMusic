using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HoYoMusic.Desktop.App.ViewModels;

public partial class MainViewModel
{
    private const string EqualizerPresetFlat = "Flat";
    private const string EqualizerPresetVocal = "Vocal";
    private const string EqualizerPresetBassBoost = "Bass Boost";
    private const string EqualizerPresetTrebleBoost = "Treble Boost";

    [ObservableProperty]
    private bool _equalizerEnabled;

    [ObservableProperty]
    private string _equalizerPreset = EqualizerPresetFlat;

    [ObservableProperty]
    private int _equalizerLowGain;

    [ObservableProperty]
    private int _equalizerMidGain;

    [ObservableProperty]
    private int _equalizerHighGain;

    [ObservableProperty]
    private bool _crossfadeEnabled;

    [ObservableProperty]
    private int _crossfadeSeconds = 3;

    [ObservableProperty]
    private bool _spectrumEnabled = true;

    public IReadOnlyList<string> EqualizerPresets { get; } =
    [
        EqualizerPresetFlat,
        EqualizerPresetVocal,
        EqualizerPresetBassBoost,
        EqualizerPresetTrebleBoost,
    ];

    public double EqualizerGainFactor
    {
        get
        {
            if (!EqualizerEnabled)
            {
                return 1d;
            }

            var average = (EqualizerLowGain + EqualizerMidGain + EqualizerHighGain) / 3d;
            return Math.Clamp(1d + average / 30d, 0.6d, 1.4d);
        }
    }

    public string PlayerEnhancementSummary =>
        $"EQ {(EqualizerEnabled ? EqualizerPreset : "Off")} · Crossfade {(CrossfadeEnabled ? $"{Math.Clamp(CrossfadeSeconds, 0, 15)}s" : "Off")} · 频谱 {(SpectrumEnabled ? "On" : "Off")}";

    [RelayCommand]
    private void ApplyEqualizerPreset(string? preset)
    {
        var normalized = string.IsNullOrWhiteSpace(preset) ? EqualizerPresetFlat : preset.Trim();
        EqualizerPreset = normalized;

        switch (normalized)
        {
            case EqualizerPresetVocal:
                EqualizerLowGain = -2;
                EqualizerMidGain = 4;
                EqualizerHighGain = 2;
                break;
            case EqualizerPresetBassBoost:
                EqualizerLowGain = 5;
                EqualizerMidGain = 1;
                EqualizerHighGain = -1;
                break;
            case EqualizerPresetTrebleBoost:
                EqualizerLowGain = -2;
                EqualizerMidGain = 1;
                EqualizerHighGain = 5;
                break;
            default:
                EqualizerPreset = EqualizerPresetFlat;
                EqualizerLowGain = 0;
                EqualizerMidGain = 0;
                EqualizerHighGain = 0;
                break;
        }

        OnPropertyChanged(nameof(EqualizerGainFactor));
        OnPropertyChanged(nameof(PlayerEnhancementSummary));
    }

    public void UpdateSpectrumBars(double positionSeconds, double durationSeconds, double normalizedVolume)
    {
        if (!SpectrumEnabled || SpectrumBars.Count == 0)
        {
            for (var i = 0; i < SpectrumBars.Count; i++)
            {
                SpectrumBars[i] = 4;
            }

            return;
        }

        var safeDuration = durationSeconds > 0 ? durationSeconds : 180d;
        var phase = (positionSeconds / safeDuration) * Math.PI * 8;
        var volumeScale = Math.Clamp(normalizedVolume, 0.05d, 1d);

        for (var i = 0; i < SpectrumBars.Count; i++)
        {
            var wave = Math.Sin(phase + i * 0.75d);
            var amplitude = 10 + (wave + 1) * 16 * volumeScale;
            SpectrumBars[i] = Math.Clamp(amplitude, 4, 34);
        }
    }

    partial void OnEqualizerEnabledChanged(bool value)
    {
        OnPropertyChanged(nameof(EqualizerGainFactor));
        OnPropertyChanged(nameof(PlayerEnhancementSummary));
    }

    partial void OnEqualizerPresetChanged(string value)
    {
        OnPropertyChanged(nameof(PlayerEnhancementSummary));
    }

    partial void OnEqualizerLowGainChanged(int value)
    {
        OnPropertyChanged(nameof(EqualizerGainFactor));
        OnPropertyChanged(nameof(PlayerEnhancementSummary));
    }

    partial void OnEqualizerMidGainChanged(int value)
    {
        OnPropertyChanged(nameof(EqualizerGainFactor));
        OnPropertyChanged(nameof(PlayerEnhancementSummary));
    }

    partial void OnEqualizerHighGainChanged(int value)
    {
        OnPropertyChanged(nameof(EqualizerGainFactor));
        OnPropertyChanged(nameof(PlayerEnhancementSummary));
    }

    partial void OnCrossfadeEnabledChanged(bool value)
    {
        OnPropertyChanged(nameof(PlayerEnhancementSummary));
    }

    partial void OnCrossfadeSecondsChanged(int value)
    {
        CrossfadeSeconds = Math.Clamp(value, 0, 15);
        OnPropertyChanged(nameof(PlayerEnhancementSummary));
    }

    partial void OnSpectrumEnabledChanged(bool value)
    {
        OnPropertyChanged(nameof(PlayerEnhancementSummary));
    }
}

