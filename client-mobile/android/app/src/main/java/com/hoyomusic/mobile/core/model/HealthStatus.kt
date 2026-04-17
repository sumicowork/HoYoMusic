package com.hoyomusic.mobile.core.model

data class HealthStatus(
    val isHealthy: Boolean,
    val message: String,
    val database: String?,
    val timestamp: String?
)

