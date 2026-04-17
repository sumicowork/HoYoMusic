package com.hoyomusic.mobile.navigation

object AppRoutes {
    const val HOME = "home"
    const val TRACK_LIST = "track-list"
    const val TRACK_DETAIL = "track-detail/{trackId}"
    const val PLAYER = "player"
    const val LOGIN = "login"
    const val SETTINGS = "settings"
    const val FAVORITES = "favorites"
    const val PLAYLISTS = "playlists"
    const val PLAYLIST_DETAIL = "playlists/{playlistId}"
    const val DOWNLOAD_CENTER = "downloads"

    fun trackDetail(trackId: Int): String = "track-detail/$trackId"
    fun playlistDetail(playlistId: Int): String = "playlists/$playlistId"
}
