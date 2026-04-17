package com.hoyomusic.mobile.core.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class PlaylistDtoMapperTest {

    @Test
    fun mapsPlaylistDetailAndTracksSafely() {
        val detail = PlaylistDetailDataDto(
            playlist = PlaylistDto(
                id = 9,
                userId = 1,
                name = "Boss Themes",
                description = "all-time",
                coverPath = "/uploads/a.jpg",
                isPublic = false,
                trackCount = 2,
                totalDuration = 600,
                createdAt = "2026-04-10T01:00:00Z",
                updatedAt = "2026-04-10T01:10:00Z"
            ),
            tracks = listOf(
                TrackDto(
                    id = 1,
                    uuid = "u1",
                    title = "A",
                    titleCn = null,
                    titleEn = null,
                    albumId = null,
                    albumTitle = null,
                    coverPath = null,
                    duration = 120,
                    trackNumber = 1,
                    releaseDate = null,
                    effectivePlayCount = 10,
                    favoriteCount = 1,
                    artists = listOf(ArtistDto(id = 1, name = "X"))
                )
            )
        )

        val mapped = detail.toDomainOrNull()
        assertNotNull(mapped)
        assertEquals(9, mapped?.playlist?.id)
        assertEquals(1, mapped?.tracks?.size)
        assertEquals("A", mapped?.tracks?.first()?.title)
    }

    @Test
    fun mapsFavoriteCheckMapWithFallback() {
        val mapped = FavoriteCheckDataDto(favorites = mapOf(1 to true, 2 to false)).toDomain()
        assertEquals(true, mapped[1])
        assertEquals(false, mapped[2])
        assertEquals(2, mapped.size)
    }
}

