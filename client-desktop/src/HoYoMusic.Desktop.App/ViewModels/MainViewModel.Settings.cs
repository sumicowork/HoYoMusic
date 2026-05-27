using CommunityToolkit.Mvvm.Input;
using Windows.Storage;

namespace HoYoMusic.Desktop.App.ViewModels;

public partial class MainViewModel
{
    private const string LocalSettingThemeMode = "settings_theme_mode";
    private const string LocalSettingPreventDup = "settings_prevent_duplicate_queue";
    private const string LocalSettingAutoPlay = "settings_queue_auto_play_on_add";
    private const string LocalSettingSleepMinutes = "settings_sleep_timer_minutes";
    private const string LocalSettingCrossfadeEnabled = "settings_crossfade_enabled";
    private const string LocalSettingCrossfadeSeconds = "settings_crossfade_seconds";
    private const string LocalSettingEqualizerEnabled = "settings_equalizer_enabled";
    private const string LocalSettingEqualizerPreset = "settings_equalizer_preset";
    private const string LocalSettingLyricsFontSize = "settings_lyrics_font_size";

    private bool _isLoadingSettings;

    [RelayCommand]
    private void ResetAllSettings()
    {
        ThemeMode = "system";
        PreventDuplicateQueueItems = true;
        QueueAutoPlayOnAdd = false;
        SleepTimerMinutes = 15;
        CrossfadeEnabled = false;
        CrossfadeSeconds = 3;
        EqualizerEnabled = false;
        ApplyEqualizerPreset("Flat");
        LyricsFontSize = 14;

        SaveAllSettings();
        SuccessMessage = "所有设置已重置为默认值。";
    }

    internal void LoadSettings()
    {
        _isLoadingSettings = true;

        ThemeMode = ReadLocalSetting(LocalSettingThemeMode, "system");
        PreventDuplicateQueueItems = ReadLocalSetting(LocalSettingPreventDup, true);
        QueueAutoPlayOnAdd = ReadLocalSetting(LocalSettingAutoPlay, false);
        SleepTimerMinutes = ReadLocalSetting(LocalSettingSleepMinutes, 15);
        CrossfadeEnabled = ReadLocalSetting(LocalSettingCrossfadeEnabled, false);
        CrossfadeSeconds = ReadLocalSetting(LocalSettingCrossfadeSeconds, 3);
        EqualizerEnabled = ReadLocalSetting(LocalSettingEqualizerEnabled, false);
        if (!string.IsNullOrWhiteSpace(EqualizerPreset))
        {
            ApplyEqualizerPreset(ReadLocalSetting(LocalSettingEqualizerPreset, "Flat"));
        }
        LyricsFontSize = ReadLocalSetting(LocalSettingLyricsFontSize, 14);

        _isLoadingSettings = false;
    }

    internal void SaveAllSettings()
    {
        WriteLocalSetting(LocalSettingThemeMode, ThemeMode);
        WriteLocalSetting(LocalSettingPreventDup, PreventDuplicateQueueItems);
        WriteLocalSetting(LocalSettingAutoPlay, QueueAutoPlayOnAdd);
        WriteLocalSetting(LocalSettingSleepMinutes, SleepTimerMinutes);
        WriteLocalSetting(LocalSettingCrossfadeEnabled, CrossfadeEnabled);
        WriteLocalSetting(LocalSettingCrossfadeSeconds, CrossfadeSeconds);
        WriteLocalSetting(LocalSettingEqualizerEnabled, EqualizerEnabled);
        WriteLocalSetting(LocalSettingEqualizerPreset, EqualizerPreset);
        WriteLocalSetting(LocalSettingLyricsFontSize, LyricsFontSize);
    }

    internal void PersistThemeMode(string value)
    {
        if (_isLoadingSettings) return;
        WriteLocalSetting(LocalSettingThemeMode, value);
    }

    internal void PersistQueueBehavior()
    {
        if (_isLoadingSettings) return;
        WriteLocalSetting(LocalSettingPreventDup, PreventDuplicateQueueItems);
        WriteLocalSetting(LocalSettingAutoPlay, QueueAutoPlayOnAdd);
    }

    internal void PersistSleepTimerMinutes()
    {
        if (_isLoadingSettings) return;
        WriteLocalSetting(LocalSettingSleepMinutes, SleepTimerMinutes);
    }

    internal void PersistCrossfade()
    {
        if (_isLoadingSettings) return;
        WriteLocalSetting(LocalSettingCrossfadeEnabled, CrossfadeEnabled);
        WriteLocalSetting(LocalSettingCrossfadeSeconds, CrossfadeSeconds);
    }

    internal void PersistEqualizer()
    {
        if (_isLoadingSettings) return;
        WriteLocalSetting(LocalSettingEqualizerEnabled, EqualizerEnabled);
        WriteLocalSetting(LocalSettingEqualizerPreset, EqualizerPreset);
    }

    internal void PersistLyricsFontSize()
    {
        if (_isLoadingSettings) return;
        WriteLocalSetting(LocalSettingLyricsFontSize, LyricsFontSize);
    }

    partial void OnThemeModeChanged(string value)
    {
        PersistThemeMode(value);
    }

    private static string ReadLocalSetting(string key, string defaultValue)
    {
        try { return ApplicationData.Current.LocalSettings.Values.TryGetValue(key, out var raw) && raw is string value ? value : defaultValue; }
        catch { return defaultValue; }
    }

    private static bool ReadLocalSetting(string key, bool defaultValue)
    {
        try { return ApplicationData.Current.LocalSettings.Values.TryGetValue(key, out var raw) && raw is bool value ? value : defaultValue; }
        catch { return defaultValue; }
    }

    private static int ReadLocalSetting(string key, int defaultValue)
    {
        try { return ApplicationData.Current.LocalSettings.Values.TryGetValue(key, out var raw) && raw is int value ? value : defaultValue; }
        catch { return defaultValue; }
    }

    private static void WriteLocalSetting(string key, object value)
    {
        try { ApplicationData.Current.LocalSettings.Values[key] = value; }
        catch { /* Ignore settings persistence errors when running unpackaged. */ }
    }
}
