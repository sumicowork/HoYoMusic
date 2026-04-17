package com.hoyomusic.mobile.feature.favorite

import com.hoyomusic.mobile.core.model.Track
import org.junit.Assert.assertEquals
import org.junit.Test

class FavoriteUiStateTest {

    @Test
    fun appliesQueryAndSort() {
        val state = FavoriteUiState(
            tracks = listOf(track(1, "Beta"), track(2, "Alpha"), track(3, "Gamma")),
            query = "a",
            sortMode = FavoriteSortMode.TITLE_ASC
        )

        assertEquals(listOf("Alpha", "Beta", "Gamma"), state.visibleTracks.map { it.title })
    }

    private fun track(id: Int, title: String): Track {
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
            artists = emptyList()
        )
    }
}

