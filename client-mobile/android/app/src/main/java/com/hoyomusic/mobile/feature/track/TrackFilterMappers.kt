package com.hoyomusic.mobile.feature.track

import com.hoyomusic.mobile.core.model.TrackSearchParams

fun TrackFilterUiState.toParams(search: String, page: Int, limit: Int): TrackSearchParams {
    fun parseInts(raw: String): List<Int> {
        return raw.split(',').mapNotNull { it.trim().toIntOrNull() }
    }

    return TrackSearchParams(
        search = search,
        gameIds = parseInts(gameIdsRaw),
        artist = artist.ifBlank { null },
        titleExact = titleExact.ifBlank { null },
        albumExact = albumExact.ifBlank { null },
        yearFrom = yearFrom.toIntOrNull(),
        yearTo = yearTo.toIntOrNull(),
        durationMin = durationMin.toIntOrNull(),
        durationMax = durationMax.toIntOrNull(),
        durationBucket = durationBucket.ifBlank { null },
        sampleRateMin = sampleRateMin.toIntOrNull(),
        bitDepth = bitDepth.toIntOrNull(),
        tagIds = parseInts(tagIdsRaw),
        tagLogic = tagLogic.ifBlank { null },
        hasLyrics = hasLyrics,
        lyricsStatus = lyricsStatus.ifBlank { null },
        sortBy = sortBy,
        sortDir = sortDir,
        page = page,
        limit = limit
    )
}

