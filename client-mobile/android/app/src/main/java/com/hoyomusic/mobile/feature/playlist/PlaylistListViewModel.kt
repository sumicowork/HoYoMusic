package com.hoyomusic.mobile.feature.playlist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.model.Playlist
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.data.PlaylistRepository
import com.hoyomusic.mobile.session.SessionGate
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

enum class PlaylistSortMode {
    UPDATED_DESC,
    NAME_ASC,
    TRACK_COUNT_DESC
}

data class PlaylistListUiState(
    val playlists: List<Playlist> = emptyList(),
    val loading: Boolean = true,
    val query: String = "",
    val sortMode: PlaylistSortMode = PlaylistSortMode.UPDATED_DESC,
    val requestLogin: Boolean = false,
    val error: String? = null,
    val creating: Boolean = false
) {
    val visiblePlaylists: List<Playlist>
        get() {
            val filtered = if (query.isBlank()) playlists else playlists.filter {
                it.name.contains(query.trim(), ignoreCase = true)
            }
            return when (sortMode) {
                PlaylistSortMode.UPDATED_DESC -> filtered.sortedByDescending { it.updatedAt.orEmpty() }
                PlaylistSortMode.NAME_ASC -> filtered.sortedBy { it.name.lowercase() }
                PlaylistSortMode.TRACK_COUNT_DESC -> filtered.sortedByDescending { it.trackCount }
            }
        }
}

@HiltViewModel
class PlaylistListViewModel @Inject constructor(
    private val playlistRepository: PlaylistRepository,
    private val sessionGate: SessionGate
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlaylistListUiState())
    val uiState: StateFlow<PlaylistListUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        if (!sessionGate.ensureAuthenticated("歌单功能")) {
            _uiState.value = _uiState.value.copy(loading = false, requestLogin = true)
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            when (val result = playlistRepository.getPlaylists().first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(loading = false, playlists = result.data)
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(loading = false, error = result.error.message)
                }
            }
        }
    }

    fun updateQuery(value: String) {
        _uiState.value = _uiState.value.copy(query = value)
    }

    fun updateSortMode(mode: PlaylistSortMode) {
        _uiState.value = _uiState.value.copy(sortMode = mode)
    }

    fun createPlaylist(name: String, description: String?) {
        if (name.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "歌单名称不能为空")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(creating = true, error = null)
            when (val result = playlistRepository.createPlaylist(name.trim(), description?.trim()?.ifBlank { null }).first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        creating = false,
                        playlists = listOf(result.data) + _uiState.value.playlists
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(creating = false, error = result.error.message)
                }
            }
        }
    }

    fun deletePlaylist(playlistId: Int) {
        viewModelScope.launch {
            when (val result = playlistRepository.deletePlaylist(playlistId).first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        playlists = _uiState.value.playlists.filterNot { it.id == playlistId }
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(error = result.error.message)
                }
            }
        }
    }

    fun consumeLoginRequest() {
        _uiState.value = _uiState.value.copy(requestLogin = false)
    }
}

