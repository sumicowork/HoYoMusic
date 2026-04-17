package com.hoyomusic.mobile.feature.settings

import android.content.SharedPreferences
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DebugSettingsStore @Inject constructor(
    private val sharedPreferences: SharedPreferences
) {
    companion object {
        private const val KEY_NETWORK_LOG_ENABLED = "debug_network_log_enabled"
        private const val KEY_FORCE_OFFLINE = "debug_force_offline"
        private const val KEY_LOW_DATA_MODE = "debug_low_data_mode"
    }

    fun networkLogEnabled(): Boolean = sharedPreferences.getBoolean(KEY_NETWORK_LOG_ENABLED, false)

    fun setNetworkLogEnabled(enabled: Boolean) {
        sharedPreferences.edit().putBoolean(KEY_NETWORK_LOG_ENABLED, enabled).apply()
    }

    fun forceOffline(): Boolean = sharedPreferences.getBoolean(KEY_FORCE_OFFLINE, false)

    fun setForceOffline(enabled: Boolean) {
        sharedPreferences.edit().putBoolean(KEY_FORCE_OFFLINE, enabled).apply()
    }

    fun lowDataMode(): Boolean = sharedPreferences.getBoolean(KEY_LOW_DATA_MODE, false)

    fun setLowDataMode(enabled: Boolean) {
        sharedPreferences.edit().putBoolean(KEY_LOW_DATA_MODE, enabled).apply()
    }

    fun clear() {
        sharedPreferences.edit()
            .remove(KEY_NETWORK_LOG_ENABLED)
            .remove(KEY_FORCE_OFFLINE)
            .remove(KEY_LOW_DATA_MODE)
            .apply()
    }
}

