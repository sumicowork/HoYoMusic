package com.hoyomusic.mobile.core.network

import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import org.junit.Assert.assertTrue
import org.junit.Test

class ErrorMapperTest {

    @Test
    fun mapsHttp429ToRateLimited() {
        val error = ErrorMapper.fromHttpStatus(429, "too many")
        assertTrue(error is NetworkError.RateLimited)
    }

    @Test
    fun mapsUnknownHostToNoNetwork() {
        val error = ErrorMapper.fromThrowable(UnknownHostException("dns"))
        assertTrue(error is NetworkError.NoNetwork)
    }

    @Test
    fun mapsSocketTimeoutToRequestTimeout() {
        val error = ErrorMapper.fromThrowable(SocketTimeoutException("timeout"))
        assertTrue(error is NetworkError.RequestTimeout)
    }

    @Test
    fun mapsSslToSslError() {
        val error = ErrorMapper.fromThrowable(SSLException("ssl"))
        assertTrue(error is NetworkError.SslError)
    }
}

