package com.hoyomusic.mobile.core.diagnostics

import com.hoyomusic.mobile.core.common.NetworkStatusMonitor
import com.hoyomusic.mobile.feature.settings.DebugSettingsStore
import com.hoyomusic.mobile.session.SessionManager
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DiagnosticsSnapshotBuilder @Inject constructor(
    private val sessionManager: SessionManager,
    private val debugSettingsStore: DebugSettingsStore,
    private val networkStatusMonitor: NetworkStatusMonitor
) {
    fun build(): Map<String, Any?> {
        return mapOf(
            "timestamp" to Instant.now().toString(),
            "hasToken" to !sessionManager.getToken().isNullOrBlank(),
            "networkOnline" to networkStatusMonitor.isOnline.value,
            "debug" to mapOf(
                "networkLogEnabled" to debugSettingsStore.networkLogEnabled(),
                "forceOffline" to debugSettingsStore.forceOffline(),
                "lowDataMode" to debugSettingsStore.lowDataMode()
            )
        )
    }
}

