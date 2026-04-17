package com.hoyomusic.mobile.navigation

import org.junit.Assert.assertEquals
import org.junit.Test

class AppRoutesTest {

    @Test
    fun buildsTrackAndPlaylistDetailRoutes() {
        assertEquals("track-detail/77", AppRoutes.trackDetail(77))
        assertEquals("playlists/8", AppRoutes.playlistDetail(8))
    }

    @Test
    fun keepsNamedRouteConstantsStable() {
        assertEquals("favorites", AppRoutes.FAVORITES)
        assertEquals("playlists", AppRoutes.PLAYLISTS)
        assertEquals("downloads", AppRoutes.DOWNLOAD_CENTER)
    }
}

