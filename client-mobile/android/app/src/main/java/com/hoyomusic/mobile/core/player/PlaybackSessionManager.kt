package com.hoyomusic.mobile.core.player

import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackSessionManager @Inject constructor() {
    private var currentTrackId: Int? = null
    private var sessionKey: String? = null

    fun sessionForTrack(trackId: Int): String {
        if (currentTrackId == trackId && !sessionKey.isNullOrBlank()) {
            return sessionKey!!
        }
        currentTrackId = trackId
        sessionKey = "trk-$trackId-${UUID.randomUUID()}"
        return sessionKey!!
    }

    fun clear() {
        currentTrackId = null
        sessionKey = null
    }
}

