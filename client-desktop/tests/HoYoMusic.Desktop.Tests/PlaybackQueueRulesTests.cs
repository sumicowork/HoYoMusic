using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Tests;

public class PlaybackQueueRulesTests
{
    [Fact]
    public void TryGetNextIndex_SequenceAtEnd_ReturnsFalse()
    {
        var moved = PlaybackQueueRules.TryGetNextIndex("sequence", 2, 3, new Random(7), out var next);

        Assert.False(moved);
        Assert.Equal(2, next);
    }

    [Fact]
    public void TryGetPreviousIndex_SequenceAtStart_ReturnsFalse()
    {
        var moved = PlaybackQueueRules.TryGetPreviousIndex("sequence", 0, 3, new Random(7), out var previous);

        Assert.False(moved);
        Assert.Equal(0, previous);
    }

    [Fact]
    public void TryGetNextIndex_LoopAtEnd_WrapsToFirst()
    {
        var moved = PlaybackQueueRules.TryGetNextIndex("loop", 2, 3, new Random(7), out var next);

        Assert.True(moved);
        Assert.Equal(0, next);
    }

    [Fact]
    public void TryGetPreviousIndex_LoopAtStart_WrapsToLast()
    {
        var moved = PlaybackQueueRules.TryGetPreviousIndex("loop", 0, 3, new Random(7), out var previous);

        Assert.True(moved);
        Assert.Equal(2, previous);
    }

    [Fact]
    public void TryGetNextIndex_ShuffleWithSingleTrack_ReturnsFalse()
    {
        var moved = PlaybackQueueRules.TryGetNextIndex("shuffle", 0, 1, new Random(7), out var next);

        Assert.False(moved);
        Assert.Equal(0, next);
    }

    [Fact]
    public void TryGetNextIndex_ShuffleWithManyTracks_NeverReturnsCurrent()
    {
        var moved = PlaybackQueueRules.TryGetNextIndex("shuffle", 1, 3, new Random(7), out var next);

        Assert.True(moved);
        Assert.InRange(next, 0, 2);
        Assert.NotEqual(1, next);
    }

    [Fact]
    public void TryGetNextIndex_SingleMode_UsesSequenceBehavior()
    {
        var moved = PlaybackQueueRules.TryGetNextIndex("single", 2, 3, new Random(7), out var next);

        Assert.False(moved);
        Assert.Equal(2, next);
    }

    [Fact]
    public void TryGetNextIndex_InvalidCurrentIndex_ReturnsFalse()
    {
        var moved = PlaybackQueueRules.TryGetNextIndex("loop", -1, 3, new Random(7), out var next);

        Assert.False(moved);
        Assert.Equal(-1, next);
    }

    [Fact]
    public void TryGetIndexOnTrackEnded_SingleMode_ReplaysCurrent()
    {
        var moved = PlaybackQueueRules.TryGetIndexOnTrackEnded("single", 1, 3, new Random(7), out var target);

        Assert.True(moved);
        Assert.Equal(1, target);
    }

    [Fact]
    public void TryGetIndexOnTrackEnded_SequenceAtEnd_ReturnsFalse()
    {
        var moved = PlaybackQueueRules.TryGetIndexOnTrackEnded("sequence", 2, 3, new Random(7), out var target);

        Assert.False(moved);
        Assert.Equal(2, target);
    }

    [Fact]
    public void TryGetIndexOnTrackEnded_LoopAtEnd_WrapsToFirst()
    {
        var moved = PlaybackQueueRules.TryGetIndexOnTrackEnded("loop", 2, 3, new Random(7), out var target);

        Assert.True(moved);
        Assert.Equal(0, target);
    }

    [Fact]
    public void TryGetIndexOnTrackEnded_ShuffleWithSingleTrack_ReturnsFalse()
    {
        var moved = PlaybackQueueRules.TryGetIndexOnTrackEnded("shuffle", 0, 1, new Random(7), out var target);

        Assert.False(moved);
        Assert.Equal(0, target);
    }

    [Fact]
    public void TryGetIndexOnTrackEnded_InvalidIndex_ReturnsFalse()
    {
        var moved = PlaybackQueueRules.TryGetIndexOnTrackEnded("single", -1, 3, new Random(7), out var target);

        Assert.False(moved);
        Assert.Equal(-1, target);
    }

    [Fact]
    public void DecideAfterRemoval_RemoveCurrentMiddle_AutoplaysNextAtSameIndex()
    {
        var decision = PlaybackQueueRules.DecideAfterRemoval(currentIndex: 1, removedIndex: 1, queueCountBefore: 3);

        Assert.True(decision.IsValidRemoval);
        Assert.False(decision.QueueBecomesEmpty);
        Assert.Equal(1, decision.NextIndex);
        Assert.True(decision.ShouldStartReplacementPlayback);
    }

    [Fact]
    public void DecideAfterRemoval_RemoveCurrentLast_WrapsToFirst()
    {
        var decision = PlaybackQueueRules.DecideAfterRemoval(currentIndex: 2, removedIndex: 2, queueCountBefore: 3);

        Assert.True(decision.IsValidRemoval);
        Assert.False(decision.QueueBecomesEmpty);
        Assert.Equal(0, decision.NextIndex);
        Assert.True(decision.ShouldStartReplacementPlayback);
    }

    [Fact]
    public void DecideAfterRemoval_RemoveOnlyTrack_QueueBecomesEmpty()
    {
        var decision = PlaybackQueueRules.DecideAfterRemoval(currentIndex: 0, removedIndex: 0, queueCountBefore: 1);

        Assert.True(decision.IsValidRemoval);
        Assert.True(decision.QueueBecomesEmpty);
        Assert.Equal(-1, decision.NextIndex);
        Assert.False(decision.ShouldStartReplacementPlayback);
    }

    [Fact]
    public void DecideAfterRemoval_RemoveBeforeCurrent_ShiftsIndexLeft()
    {
        var decision = PlaybackQueueRules.DecideAfterRemoval(currentIndex: 2, removedIndex: 1, queueCountBefore: 4);

        Assert.True(decision.IsValidRemoval);
        Assert.False(decision.QueueBecomesEmpty);
        Assert.Equal(1, decision.NextIndex);
        Assert.False(decision.ShouldStartReplacementPlayback);
    }

    [Fact]
    public void DecideAfterRemoval_RemoveAfterCurrent_KeepsIndex()
    {
        var decision = PlaybackQueueRules.DecideAfterRemoval(currentIndex: 1, removedIndex: 3, queueCountBefore: 5);

        Assert.True(decision.IsValidRemoval);
        Assert.False(decision.QueueBecomesEmpty);
        Assert.Equal(1, decision.NextIndex);
        Assert.False(decision.ShouldStartReplacementPlayback);
    }
}

