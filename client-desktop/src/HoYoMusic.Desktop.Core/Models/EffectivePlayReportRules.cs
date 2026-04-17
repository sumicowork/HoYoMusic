namespace HoYoMusic.Desktop.Core.Models;

public static class EffectivePlayReportRules
{
    private const int MinThresholdSeconds = 10;
    private const int MaxThresholdSeconds = 30;
    private const int DefaultDurationSeconds = 60;

    public static int ResolveThresholdSeconds(int? durationSeconds)
    {
        var safeDuration = durationSeconds.GetValueOrDefault() > 0
            ? durationSeconds!.Value
            : DefaultDurationSeconds;

        var halfDuration = safeDuration * 0.5;
        return (int)Math.Round(Math.Clamp(halfDuration, MinThresholdSeconds, MaxThresholdSeconds), MidpointRounding.AwayFromZero);
    }

    public static bool ShouldReport(int playedSeconds, int? durationSeconds, bool alreadyReported)
    {
        if (alreadyReported)
        {
            return false;
        }

        return playedSeconds >= ResolveThresholdSeconds(durationSeconds);
    }
}

