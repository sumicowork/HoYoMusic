package com.hoyomusic.mobile.feature.playlist

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.model.Playlist
import com.hoyomusic.mobile.core.model.Track
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

enum class PlaylistTrackSortMode {
    POSITION,
    TITLE_ASC,
    TITLE_DESC
}

data class PlaylistDetailUiState(
    val playlist: Playlist? = null,
    val tracks: List<Track> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val query: String = "",
    val sortMode: PlaylistTrackSortMode = PlaylistTrackSortMode.POSITION,
    val requestLogin: Boolean = false,
    val error: String? = null
) {
    val visibleTracks: List<Track>
        get() {
            val filtered = if (query.isBlank()) tracks else tracks.filter {
                it.title.contains(query.trim(), ignoreCase = true) ||
                    it.artists.any { artist -> artist.name.contains(query.trim(), ignoreCase = true) }
            }
            return when (sortMode) {
                PlaylistTrackSortMode.POSITION -> filtered
                PlaylistTrackSortMode.TITLE_ASC -> filtered.sortedBy { it.title.lowercase() }
                PlaylistTrackSortMode.TITLE_DESC -> filtered.sortedByDescending { it.title.lowercase() }
            }
        }
}

@HiltViewModel
class PlaylistDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val playlistRepository: PlaylistRepository,
    private val sessionGate: SessionGate
) : ViewModel() {

    private val playlistId: Int = checkNotNull(savedStateHandle["playlistId"])

    private val _uiState = MutableStateFlow(PlaylistDetailUiState())
    val uiState: StateFlow<PlaylistDetailUiState> = _uiState.asStateFlow()

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
            when (val result = playlistRepository.getPlaylistDetail(playlistId).first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        playlist = result.data.playlist,
                        tracks = result.data.tracks
                    )
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

    fun updateSortMode(mode: PlaylistTrackSortMode) {
        _uiState.value = _uiState.value.copy(sortMode = mode)
    }

    fun updateMeta(name: String, description: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(saving = true, error = null)
            when (val result = playlistRepository.updatePlaylist(playlistId, name.trim(), description?.trim()).first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(saving = false, playlist = result.data)
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(saving = false, error = result.error.message)
                }
            }
        }
    }

    fun removeTrack(trackId: Int) {
        viewModelScope.launch {
            when (val result = playlistRepository.removeTrack(playlistId, trackId).first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(tracks = _uiState.value.tracks.filterNot { it.id == trackId })
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(error = result.error.message)
                }
            }
        }
    }

    fun moveTrack(trackId: Int, direction: Int) {
        val current = _uiState.value.tracks
        val index = current.indexOfFirst { it.id == trackId }
        if (index == -1) return
        val targetIndex = index + direction
        if (targetIndex !in current.indices) return

        val mutable = current.toMutableList()
        val item = mutable.removeAt(index)
        mutable.add(targetIndex, item)
        _uiState.value = _uiState.value.copy(tracks = mutable)

        viewModelScope.launch {
            val ids = mutable.map { it.id }
            when (val result = playlistRepository.reorderTracks(playlistId, ids).first()) {
                is ApiResult.Success -> Unit
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(error = result.error.message)
                }
            }
        }
    }

    fun addTrack(trackId: Int) {
        viewModelScope.launch {
            when (val result = playlistRepository.addTrack(playlistId, trackId).first()) {
                is ApiResult.Success -> refresh()
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

