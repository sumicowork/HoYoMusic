package com.hoyomusic.mobile.session

import com.hoyomusic.mobile.core.common.UiMessageBus
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionGate @Inject constructor(
    private val sessionManager: SessionManager,
    private val messageBus: UiMessageBus
) {
    fun isAuthenticated(): Boolean = !sessionManager.getToken().isNullOrBlank()

    fun ensureAuthenticated(featureName: String): Boolean {
        if (isAuthenticated()) return true
        messageBus.push("$featureName 需要登录后使用")
        return false
    }
}

