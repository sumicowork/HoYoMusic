package com.hoyomusic.mobile.session

import android.content.SharedPreferences
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

@Singleton
class SessionManager @Inject constructor(
    private val securePrefs: SharedPreferences
) {
    companion object {
        private const val KEY_TOKEN = "session_token"
    }

    private val _state = MutableStateFlow<SessionState>(SessionState.Anonymous)
    val state: StateFlow<SessionState> = _state.asStateFlow()

    fun getToken(): String? = securePrefs.getString(KEY_TOKEN, null)

    fun hasToken(): Boolean = !getToken().isNullOrBlank()

    fun updateToken(token: String) {
        securePrefs.edit().putString(KEY_TOKEN, token).apply()
    }

    fun clearToken() {
        securePrefs.edit().remove(KEY_TOKEN).apply()
        _state.value = SessionState.Anonymous
    }

    fun markAuthenticating() {
        _state.value = SessionState.Authenticating
    }

    fun markAuthenticated(user: SessionUser) {
        _state.value = SessionState.Authenticated(user)
    }

    fun markExpired() {
        _state.value = SessionState.Expired
        clearToken()
    }
}
