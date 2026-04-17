package com.hoyomusic.mobile.core.network

class RetryPolicy(
    private val baseDelayMs: Long = 600,
    private val maxRetries: Int = 2
) {
    fun shouldRetry(method: String, code: Int, attempt: Int): Boolean {
        if (method != "GET") return false
        if (attempt >= maxRetries) return false
        return code == 429 || code == 503 || code == 408
    }

    fun delayFor(attempt: Int): Long {
        val expo = baseDelayMs * (attempt + 1)
        val jitter = ((attempt + 1) * 137L) % 90L
        return expo + jitter
    }
}

