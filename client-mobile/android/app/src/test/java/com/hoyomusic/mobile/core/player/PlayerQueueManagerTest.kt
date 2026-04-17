package com.hoyomusic.mobile.core.player

import com.hoyomusic.mobile.core.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PlayerQueueManagerTest {
    private val queueManager = PlayerQueueManager()
    private val tracks = listOf(
        track(1, "A"),
        track(2, "B"),
        track(3, "C")
    )

    @Test
    fun sequenceStopsAtEnd() {
        val next = queueManager.nextIndex(tracks, 2, PlayMode.SEQUENCE)
        assertNull(next)
    }

    @Test
    fun loopWrapsToStart() {
        val next = queueManager.nextIndex(tracks, 2, PlayMode.LOOP)
        assertEquals(0, next)
    }

    @Test
    fun singleKeepsCurrentIndex() {
        val next = queueManager.nextIndex(tracks, 1, PlayMode.SINGLE)
        assertEquals(1, next)
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
            durationSeconds = 120,
            trackNumber = null,
            releaseDate = null,
            effectivePlayCount = null,
            favoriteCount = null,
            artists = emptyList()
        )
    }
}

