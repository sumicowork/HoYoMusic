package com.hoyomusic.mobile.core.player

import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackFailureTracker @Inject constructor() {
    private var count: Int = 0

    fun onFailure(): Int {
        count += 1
        return count
    }

    fun reset() {
        count = 0
    }

    fun current(): Int = count
}

