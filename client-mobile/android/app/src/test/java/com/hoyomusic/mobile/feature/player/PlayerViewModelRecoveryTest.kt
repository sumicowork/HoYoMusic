package com.hoyomusic.mobile.feature.player

import com.hoyomusic.mobile.core.player.PlaybackFailureTracker
import org.junit.Assert.assertEquals
import org.junit.Test

class PlayerViewModelRecoveryTest {

    @Test
    fun failureTrackerTripsAfterThreeFailures() {
        val tracker = PlaybackFailureTracker()
        assertEquals(1, tracker.onFailure())
        assertEquals(2, tracker.onFailure())
        assertEquals(3, tracker.onFailure())
    }

    @Test
    fun failureTrackerResetsAfterRecovery() {
        val tracker = PlaybackFailureTracker()
        tracker.onFailure()
        tracker.onFailure()
        tracker.reset()
        assertEquals(0, tracker.current())
    }
}

