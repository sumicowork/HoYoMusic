package com.hoyomusic.mobile.feature.favorite

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.data.DownloadRepository
import com.hoyomusic.mobile.data.FavoriteRepository
import com.hoyomusic.mobile.data.PlaylistRepository
import com.hoyomusic.mobile.feature.playlist.PlaylistPickerState
import com.hoyomusic.mobile.session.SessionGate
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

enum class FavoriteSortMode {
    LATEST,
    TITLE_ASC,
    TITLE_DESC
}

data class FavoriteUiState(
    val tracks: List<Track> = emptyList(),
    val loading: Boolean = true,
    val page: Int = 1,
    val hasMore: Boolean = true,
    val query: String = "",
    val sortMode: FavoriteSortMode = FavoriteSortMode.LATEST,
    val picker: PlaylistPickerState = PlaylistPickerState(),
    val pickerTrackId: Int? = null,
    val requestLogin: Boolean = false,
    val error: String? = null,
    val operatingTrackId: Int? = null
) {
    val visibleTracks: List<Track>
        get() {
            val filtered = if (query.isBlank()) {
                tracks
            } else {
                tracks.filter {
                    it.title.contains(query.trim(), ignoreCase = true) ||
                        (it.albumTitle?.contains(query.trim(), ignoreCase = true) == true)
                }
            }
            return when (sortMode) {
                FavoriteSortMode.LATEST -> filtered
                FavoriteSortMode.TITLE_ASC -> filtered.sortedBy { it.title.lowercase() }
                FavoriteSortMode.TITLE_DESC -> filtered.sortedByDescending { it.title.lowercase() }
            }
        }
}

@HiltViewModel
class FavoriteViewModel @Inject constructor(
    private val favoriteRepository: FavoriteRepository,
    private val playlistRepository: PlaylistRepository,
    private val downloadRepository: DownloadRepository,
    private val sessionGate: SessionGate
) : ViewModel() {

    private val _uiState = MutableStateFlow(FavoriteUiState())
    val uiState: StateFlow<FavoriteUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        if (!sessionGate.ensureAuthenticated("收藏功能")) {
            _uiState.value = _uiState.value.copy(loading = false, requestLogin = true)
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null, page = 1)
            when (val favoritesResult = favoriteRepository.getFavorites(page = 1, limit = 30).first()) {
                is ApiResult.Success -> {
                    val pageData = favoritesResult.data
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        tracks = pageData.tracks,
                        page = 1,
                        hasMore = pageData.pagination.page < pageData.pagination.totalPages,
                        error = null
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(loading = false, error = favoritesResult.error.message)
                }
            }
        }
    }

    fun updateQuery(value: String) {
        _uiState.value = _uiState.value.copy(query = value)
    }

    fun updateSortMode(mode: FavoriteSortMode) {
        _uiState.value = _uiState.value.copy(sortMode = mode)
    }

    fun loadMore() {
        val state = _uiState.value
        if (state.loading || !state.hasMore) return

        viewModelScope.launch {
            val nextPage = state.page + 1
            _uiState.value = state.copy(loading = true, error = null)
            when (val result = favoriteRepository.getFavorites(page = nextPage, limit = 30).first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        page = nextPage,
                        tracks = state.tracks + result.data.tracks,
                        hasMore = nextPage < result.data.pagination.totalPages
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(loading = false, error = result.error.message)
                }
            }
        }
    }

    fun toggleFavorite(track: Track) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(operatingTrackId = track.id)
            when (val result = favoriteRepository.toggle(track.id).first()) {
                is ApiResult.Success -> {
                    if (!result.data) {
                        _uiState.value = _uiState.value.copy(
                            tracks = _uiState.value.tracks.filterNot { it.id == track.id },
                            operatingTrackId = null
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(operatingTrackId = null)
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(operatingTrackId = null, error = result.error.message)
                }
            }
        }
    }

    fun enqueueDownload(track: Track) {
        downloadRepository.enqueue(track)
    }

    fun openPlaylistPicker(trackId: Int) {
        _uiState.value = _uiState.value.copy(
            pickerTrackId = trackId,
            picker = _uiState.value.picker.copy(visible = true, loading = true)
        )
        viewModelScope.launch {
            when (val result = playlistRepository.getPlaylists().first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(loading = false, playlists = result.data, error = null)
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(loading = false, error = result.error.message)
                    )
                }
            }
        }
    }

    fun closePlaylistPicker() {
        _uiState.value = _uiState.value.copy(picker = PlaylistPickerState(), pickerTrackId = null)
    }

    fun updatePickerQuery(value: String) {
        _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(query = value))
    }

    fun updateNewPlaylistName(value: String) {
        _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(newPlaylistName = value))
    }

    fun addTrackToPlaylist(playlistId: Int) {
        val trackId = _uiState.value.pickerTrackId ?: return
        viewModelScope.launch {
            when (val result = playlistRepository.addTrack(playlistId, trackId).first()) {
                is ApiResult.Success -> closePlaylistPicker()
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(error = result.error.message))
                }
            }
        }
    }

    fun createPlaylistAndAdd() {
        val name = _uiState.value.picker.newPlaylistName.trim()
        if (name.isBlank()) {
            _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(error = "请输入歌单名称"))
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(creating = true, error = null))
            when (val createResult = playlistRepository.createPlaylist(name, null).first()) {
                is ApiResult.Success -> addTrackToPlaylist(createResult.data.id)
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(creating = false, error = createResult.error.message)
                    )
                }
            }
        }
    }

    fun consumeLoginRequest() {
        _uiState.value = _uiState.value.copy(requestLogin = false)
    }
}
