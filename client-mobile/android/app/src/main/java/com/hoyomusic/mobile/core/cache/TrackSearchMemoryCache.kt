package com.hoyomusic.mobile.core.cache

import com.hoyomusic.mobile.core.model.TrackPage
import java.util.LinkedHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TrackSearchMemoryCache @Inject constructor() {
    private val cache = object : LinkedHashMap<String, TrackPage>(32, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, TrackPage>?): Boolean {
            return size > 30
        }
    }

    fun get(key: String): TrackPage? = synchronized(cache) { cache[key] }

    fun put(key: String, page: TrackPage) = synchronized(cache) { cache[key] = page }

    fun clear() = synchronized(cache) { cache.clear() }
}

