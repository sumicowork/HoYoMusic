package com.hoyomusic.mobile.session

import com.hoyomusic.mobile.core.network.AuthTokenProvider
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionAuthTokenProvider @Inject constructor(
    private val sessionManager: SessionManager
) : AuthTokenProvider {
    override fun getTokenOrNull(): String? = sessionManager.getToken()
}

