package com.hoyomusic.mobile.data

import com.hoyomusic.mobile.core.network.ApiClient
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.core.network.AuthApi
import com.hoyomusic.mobile.core.network.LoginRequestDto
import com.hoyomusic.mobile.core.network.NetworkError
import com.hoyomusic.mobile.session.SessionManager
import com.hoyomusic.mobile.session.SessionUser
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

@Singleton
class AuthRepository @Inject constructor(
    private val apiClient: ApiClient,
    private val authApi: AuthApi,
    private val sessionManager: SessionManager
) {
    fun login(identifier: String, password: String): Flow<ApiResult<SessionUser>> = flow {
        sessionManager.markAuthenticating()
        when (
            val result = apiClient.executeEnvelope { authApi.login(LoginRequestDto(identifier, password)) }
        ) {
            is ApiResult.Success -> {
                val token = result.data.token
                val user = result.data.user
                if (token.isNullOrBlank() || user?.id == null || user.username.isNullOrBlank()) {
                    emit(ApiResult.Failure(NetworkError.Envelope("登录响应不完整")))
                } else {
                    sessionManager.updateToken(token)
                    val sessionUser = SessionUser(user.id, user.username, user.is_admin == true)
                    sessionManager.markAuthenticated(sessionUser)
                    emit(ApiResult.Success(sessionUser))
                }
            }
            is ApiResult.Failure -> emit(result)
        }
    }

    fun me(): Flow<ApiResult<SessionUser>> = flow {
        when (val result = apiClient.executeEnvelope { authApi.me() }) {
            is ApiResult.Success -> {
                val user = result.data
                if (user.id == null || user.username.isNullOrBlank()) {
                    emit(ApiResult.Failure(NetworkError.Envelope("用户信息不完整")))
                } else {
                    val sessionUser = SessionUser(user.id, user.username, user.is_admin == true)
                    sessionManager.markAuthenticated(sessionUser)
                    emit(ApiResult.Success(sessionUser))
                }
            }
            is ApiResult.Failure -> {
                if (result.error is NetworkError.Unauthorized) {
                    sessionManager.markExpired()
                }
                emit(result)
            }
        }
    }
}

