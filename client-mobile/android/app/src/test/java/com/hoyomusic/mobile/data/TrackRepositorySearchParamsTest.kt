package com.hoyomusic.mobile.data

import com.hoyomusic.mobile.core.model.TrackSearchParams
import com.hoyomusic.mobile.core.network.PublicTrackQueryMapper
import org.junit.Assert.assertEquals
import org.junit.Test

class TrackRepositorySearchParamsTest {

    @Test
    fun mapsAdvancedSearchParamsToApiQuery() {
        val params = TrackSearchParams(
            search = "test",
            gameIds = listOf(1, 2),
            artist = "artist",
            yearFrom = 2020,
            yearTo = 2025,
            durationMin = 20,
            durationMax = 300,
            tagIds = listOf(7, 9),
            tagLogic = "OR",
            hasLyrics = true,
            lyricsStatus = "has",
            page = 3,
            limit = 50
        )

        val query = PublicTrackQueryMapper.map(params)
        assertEquals("1,2", query.gameIds)
        assertEquals("7,9", query.tagIds)
        assertEquals(3, query.page)
        assertEquals(50, query.limit)
        assertEquals("OR", query.tagLogic)
        assertEquals(true, query.hasLyrics)
    }
}

