package com.hoyomusic.mobile.feature.playlist

import com.hoyomusic.mobile.core.model.Playlist

data class PlaylistPickerState(
    val visible: Boolean = false,
    val loading: Boolean = false,
    val query: String = "",
    val playlists: List<Playlist> = emptyList(),
    val creating: Boolean = false,
    val newPlaylistName: String = "",
    val error: String? = null
) {
    val filteredPlaylists: List<Playlist>
        get() {
            if (query.isBlank()) return playlists
            return playlists.filter { it.name.contains(query.trim(), ignoreCase = true) }
        }
}

