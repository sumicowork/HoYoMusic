package com.hoyomusic.mobile.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.data.HealthRepository
import com.hoyomusic.mobile.data.TrackRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val healthRepository: HealthRepository,
    private val trackRepository: TrackRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val snapshot = _uiState.value
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

            val healthDeferred = async { healthRepository.getHealthStatus().first() }
            val latestDeferred = async { trackRepository.getPublicTracks(page = 1, limit = 12).first() }
            val randomDeferred = async { trackRepository.getRandomTracks(count = 8).first() }
            val topDeferred = async { trackRepository.getTopTracks(limit = 8).first() }

            val healthResult = healthDeferred.await()
            val latestResult = latestDeferred.await()
            val randomResult = randomDeferred.await()
            val topResult = topDeferred.await()

            var nextState = _uiState.value.copy(isLoading = false)

            when (healthResult) {
                is ApiResult.Success -> {
                    nextState = nextState.copy(health = healthResult.data)
                }
                is ApiResult.Failure -> {
                    nextState = nextState.copy(errorMessage = healthResult.error.message)
                }
            }

            when (latestResult) {
                is ApiResult.Success -> {
                    nextState = nextState.copy(latestTracks = latestResult.data.tracks)
                }
                is ApiResult.Failure -> {
                    val mergedError = nextState.errorMessage ?: latestResult.error.message
                    nextState = nextState.copy(errorMessage = mergedError, latestTracks = snapshot.latestTracks)
                }
            }

            when (randomResult) {
                is ApiResult.Success -> {
                    nextState = nextState.copy(randomTracks = randomResult.data)
                }
                is ApiResult.Failure -> {
                    val mergedError = nextState.errorMessage ?: randomResult.error.message
                    nextState = nextState.copy(errorMessage = mergedError, randomTracks = snapshot.randomTracks)
                }
            }

            when (topResult) {
                is ApiResult.Success -> {
                    nextState = nextState.copy(topTracks = topResult.data)
                }
                is ApiResult.Failure -> {
                    val mergedError = nextState.errorMessage ?: topResult.error.message
                    nextState = nextState.copy(errorMessage = mergedError, topTracks = snapshot.topTracks)
                }
            }

            _uiState.value = nextState
        }
    }
}

