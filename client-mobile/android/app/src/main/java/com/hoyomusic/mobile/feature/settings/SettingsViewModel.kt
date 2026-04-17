package com.hoyomusic.mobile.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.common.NetworkStatusMonitor
import com.hoyomusic.mobile.core.network.VisitorIdProvider
import com.hoyomusic.mobile.session.SessionManager
import com.hoyomusic.mobile.session.SessionState
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SettingsUiState(
    val apiBaseUrl: String,
    val visitorId: String,
    val hasToken: Boolean,
    val sessionStatus: String,
    val online: Boolean,
    val networkLogEnabled: Boolean,
    val forceOffline: Boolean,
    val lowDataMode: Boolean
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val debugSettingsStore: DebugSettingsStore,
    private val visitorIdProvider: VisitorIdProvider,
    private val sessionManager: SessionManager,
    private val networkStatusMonitor: NetworkStatusMonitor
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        SettingsUiState(
            apiBaseUrl = com.hoyomusic.mobile.BuildConfig.API_BASE_URL,
            visitorId = visitorIdProvider.getOrCreateVisitorId(),
            hasToken = !sessionManager.getToken().isNullOrBlank(),
            sessionStatus = if (sessionManager.hasToken()) "Authenticated" else "Anonymous",
            online = networkStatusMonitor.isOnline.value,
            networkLogEnabled = debugSettingsStore.networkLogEnabled(),
            forceOffline = debugSettingsStore.forceOffline(),
            lowDataMode = debugSettingsStore.lowDataMode()
        )
    )
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            networkStatusMonitor.isOnline.collect { online ->
                _uiState.value = _uiState.value.copy(online = online)
            }
        }
        viewModelScope.launch {
            sessionManager.state.collect { sessionState ->
                _uiState.value = _uiState.value.copy(
                    hasToken = sessionManager.hasToken(),
                    sessionStatus = when (sessionState) {
                        SessionState.Anonymous -> "Anonymous"
                        SessionState.Authenticating -> "Authenticating"
                        is SessionState.Authenticated -> "Authenticated(${sessionState.user.username})"
                        SessionState.Expired -> "Expired"
                    }
                )
            }
        }
    }

    fun setNetworkLogEnabled(enabled: Boolean) {
        debugSettingsStore.setNetworkLogEnabled(enabled)
        _uiState.value = _uiState.value.copy(networkLogEnabled = enabled)
    }

    fun setForceOffline(enabled: Boolean) {
        debugSettingsStore.setForceOffline(enabled)
        _uiState.value = _uiState.value.copy(forceOffline = enabled)
    }

    fun setLowDataMode(enabled: Boolean) {
        debugSettingsStore.setLowDataMode(enabled)
        _uiState.value = _uiState.value.copy(lowDataMode = enabled)
    }

    fun clearDebugSettings() {
        debugSettingsStore.clear()
        _uiState.value = _uiState.value.copy(
            networkLogEnabled = false,
            forceOffline = false,
            lowDataMode = false
        )
    }

    fun logout() {
        sessionManager.clearToken()
        _uiState.value = _uiState.value.copy(hasToken = false, sessionStatus = "Anonymous")
    }
}

