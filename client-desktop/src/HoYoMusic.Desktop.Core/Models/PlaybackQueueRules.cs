namespace HoYoMusic.Desktop.Core.Models;

public static class PlaybackQueueRules
{
    public readonly record struct QueueRemovalDecision(bool IsValidRemoval, bool QueueBecomesEmpty, int NextIndex, bool ShouldStartReplacementPlayback);

    public static QueueRemovalDecision DecideAfterRemoval(int currentIndex, int removedIndex, int queueCountBefore)
    {
        if (queueCountBefore <= 0 || removedIndex < 0 || removedIndex >= queueCountBefore || currentIndex < 0 || currentIndex >= queueCountBefore)
        {
            return new QueueRemovalDecision(false, false, currentIndex, false);
        }

        var queueCountAfter = queueCountBefore - 1;
        if (queueCountAfter == 0)
        {
            return new QueueRemovalDecision(true, true, -1, false);
        }

        if (removedIndex < currentIndex)
        {
            return new QueueRemovalDecision(true, false, currentIndex - 1, false);
        }

        if (removedIndex > currentIndex)
        {
            return new QueueRemovalDecision(true, false, currentIndex, false);
        }

        var nextIndex = removedIndex < queueCountAfter ? removedIndex : 0;
        return new QueueRemovalDecision(true, false, nextIndex, true);
    }

    public static bool TryGetIndexOnTrackEnded(string playMode, int currentIndex, int queueCount, Random random, out int targetIndex)
    {
        targetIndex = currentIndex;
        if (!IsValidCurrentIndex(currentIndex, queueCount))
        {
            return false;
        }

        if (string.Equals(playMode, "single", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return TryGetNextIndex(playMode, currentIndex, queueCount, random, out targetIndex);
    }

    public static bool TryGetNextIndex(string playMode, int currentIndex, int queueCount, Random random, out int nextIndex)
    {
        nextIndex = currentIndex;
        if (!IsValidCurrentIndex(currentIndex, queueCount))
        {
            return false;
        }

        if (string.Equals(playMode, "shuffle", StringComparison.OrdinalIgnoreCase))
        {
            if (queueCount <= 1)
            {
                return false;
            }

            var candidate = currentIndex;
            while (candidate == currentIndex)
            {
                candidate = random.Next(0, queueCount);
            }

            nextIndex = candidate;
            return true;
        }

        if (string.Equals(playMode, "loop", StringComparison.OrdinalIgnoreCase))
        {
            nextIndex = (currentIndex + 1) % queueCount;
            return true;
        }

        if (currentIndex + 1 >= queueCount)
        {
            return false;
        }

        nextIndex = currentIndex + 1;
        return true;
    }

    public static bool TryGetPreviousIndex(string playMode, int currentIndex, int queueCount, Random random, out int previousIndex)
    {
        previousIndex = currentIndex;
        if (!IsValidCurrentIndex(currentIndex, queueCount))
        {
            return false;
        }

        if (string.Equals(playMode, "shuffle", StringComparison.OrdinalIgnoreCase))
        {
            if (queueCount <= 1)
            {
                return false;
            }

            var candidate = currentIndex;
            while (candidate == currentIndex)
            {
                candidate = random.Next(0, queueCount);
            }

            previousIndex = candidate;
            return true;
        }

        if (string.Equals(playMode, "loop", StringComparison.OrdinalIgnoreCase))
        {
            previousIndex = currentIndex <= 0 ? queueCount - 1 : currentIndex - 1;
            return true;
        }

        if (currentIndex <= 0)
        {
            return false;
        }

        previousIndex = currentIndex - 1;
        return true;
    }

    private static bool IsValidCurrentIndex(int currentIndex, int queueCount)
        => queueCount > 0 && currentIndex >= 0 && currentIndex < queueCount;
}
