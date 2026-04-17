package com.hoyomusic.mobile.session

data class SessionUser(
    val id: Int,
    val username: String,
    val isAdmin: Boolean
)

sealed interface SessionState {
    data object Anonymous : SessionState
    data object Authenticating : SessionState
    data class Authenticated(val user: SessionUser) : SessionState
    data object Expired : SessionState
}

