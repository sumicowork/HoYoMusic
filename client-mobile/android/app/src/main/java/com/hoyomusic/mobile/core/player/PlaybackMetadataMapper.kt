package com.hoyomusic.mobile.core.player

import androidx.media3.common.MediaMetadata
import com.hoyomusic.mobile.core.model.Track

object PlaybackMetadataMapper {
    fun toMediaMetadata(track: Track): MediaMetadata {
        return MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artists.joinToString(" / ") { it.name })
            .setAlbumTitle(track.albumTitle)
            .build()
    }
}

