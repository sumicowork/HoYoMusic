package com.hoyomusic.mobile.core.network

import android.content.SharedPreferences
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VisitorIdProvider @Inject constructor(
    private val sharedPreferences: SharedPreferences
) {
    companion object {
        private const val VISITOR_ID_KEY = "visitor_id"
    }

    fun getOrCreateVisitorId(): String {
        val current = sharedPreferences.getString(VISITOR_ID_KEY, null)?.trim()
        if (!current.isNullOrEmpty() && isUuid(current)) {
            return current
        }

        val generated = UUID.randomUUID().toString()
        sharedPreferences.edit().putString(VISITOR_ID_KEY, generated).apply()
        return generated
    }

    private fun isUuid(value: String): Boolean {
        return runCatching { UUID.fromString(value) }.isSuccess
    }
}

