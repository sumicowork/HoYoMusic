package com.hoyomusic.mobile.core.player

import androidx.media3.common.Player
import androidx.media3.session.MediaSession

class PlaybackMediaSessionCallback(
    private val player: Player
) : MediaSession.Callback {
    // The default MediaSession callback handles transport controls for Player.
}

