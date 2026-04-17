package com.hoyomusic.mobile.feature.playlist

import com.hoyomusic.mobile.core.model.Playlist
import org.junit.Assert.assertEquals
import org.junit.Test

class PlaylistListUiStateTest {

    @Test
    fun filtersAndSortsPlaylists() {
        val state = PlaylistListUiState(
            playlists = listOf(
                playlist(1, "Beta", 3),
                playlist(2, "Alpha", 10),
                playlist(3, "Gamma", 1)
            ),
            query = "a",
            sortMode = PlaylistSortMode.NAME_ASC
        )

        assertEquals(listOf("Alpha", "Beta", "Gamma"), state.visiblePlaylists.map { it.name })
    }

    @Test
    fun sortsByTrackCount() {
        val state = PlaylistListUiState(
            playlists = listOf(
                playlist(1, "A", 1),
                playlist(2, "B", 5),
                playlist(3, "C", 2)
            ),
            sortMode = PlaylistSortMode.TRACK_COUNT_DESC
        )

        assertEquals(listOf(5, 2, 1), state.visiblePlaylists.map { it.trackCount })
    }

    private fun playlist(id: Int, name: String, trackCount: Int): Playlist {
        return Playlist(
            id = id,
            userId = 1,
            name = name,
            description = null,
            coverPath = null,
            isPublic = false,
            trackCount = trackCount,
            totalDuration = trackCount * 100,
            createdAt = "2026-04-10",
            updatedAt = "2026-04-10"
        )
    }
}

