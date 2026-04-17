package com.hoyomusic.mobile.feature.playlist

import com.hoyomusic.mobile.core.model.Track
import org.junit.Assert.assertEquals
import org.junit.Test

class PlaylistDetailUiStateTest {

    @Test
    fun filtersByQueryAcrossTitleAndArtist() {
        val state = PlaylistDetailUiState(
            tracks = listOf(
                track(1, "Moon", "Alice"),
                track(2, "Sun", "Bob")
            ),
            query = "ali"
        )

        assertEquals(1, state.visibleTracks.size)
        assertEquals(1, state.visibleTracks.first().id)
    }

    @Test
    fun sortsTitleDescending() {
        val state = PlaylistDetailUiState(
            tracks = listOf(track(1, "A", "n"), track(2, "C", "n"), track(3, "B", "n")),
            sortMode = PlaylistTrackSortMode.TITLE_DESC
        )

        assertEquals(listOf("C", "B", "A"), state.visibleTracks.map { it.title })
    }

    private fun track(id: Int, title: String, artist: String): Track {
        return Track(
            id = id,
            uuid = null,
            title = title,
            titleCn = null,
            titleEn = null,
            albumId = null,
            albumTitle = null,
            coverPath = null,
            durationSeconds = 100,
            trackNumber = null,
            releaseDate = null,
            effectivePlayCount = null,
            favoriteCount = null,
            artists = listOf(com.hoyomusic.mobile.core.model.Artist(id = null, name = artist))
        )
    }
}

