using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Tests;

public class EffectivePlayReportRulesTests
{
    [Theory]
    [InlineData(null, 30)]
    [InlineData(8, 10)]
    [InlineData(20, 10)]
    [InlineData(40, 20)]
    [InlineData(200, 30)]
    public void ResolveThresholdSeconds_ReturnsExpectedValue(int? durationSeconds, int expected)
    {
        var threshold = EffectivePlayReportRules.ResolveThresholdSeconds(durationSeconds);

        Assert.Equal(expected, threshold);
    }

    [Theory]
    [InlineData(9, 20, false)]
    [InlineData(10, 20, true)]
    [InlineData(30, 180, true)]
    public void ShouldReport_UsesThresholdAndPlayedSeconds(int playedSeconds, int durationSeconds, bool expected)
    {
        var shouldReport = EffectivePlayReportRules.ShouldReport(playedSeconds, durationSeconds, alreadyReported: false);

        Assert.Equal(expected, shouldReport);
    }

    [Fact]
    public void ShouldReport_WhenAlreadyReported_ReturnsFalse()
    {
        var shouldReport = EffectivePlayReportRules.ShouldReport(120, 240, alreadyReported: true);

        Assert.False(shouldReport);
    }
}

