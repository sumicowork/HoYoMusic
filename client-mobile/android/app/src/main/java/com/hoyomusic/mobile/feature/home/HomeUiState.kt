package com.hoyomusic.mobile.feature.home

import com.hoyomusic.mobile.core.model.HealthStatus
import com.hoyomusic.mobile.core.model.Track

data class HomeUiState(
    val isLoading: Boolean = true,
    val health: HealthStatus? = null,
    val latestTracks: List<Track> = emptyList(),
    val randomTracks: List<Track> = emptyList(),
    val topTracks: List<Track> = emptyList(),
    val errorMessage: String? = null
)

