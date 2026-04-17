package com.hoyomusic.mobile.core.network

interface AuthTokenProvider {
    fun getTokenOrNull(): String?
}

class EmptyAuthTokenProvider : AuthTokenProvider {
    override fun getTokenOrNull(): String? = null
}

