package com.hoyomusic.mobile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.data.AuthRepository
import com.hoyomusic.mobile.session.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@HiltViewModel
class AppBootstrapViewModel @Inject constructor(
    private val sessionManager: SessionManager,
    private val authRepository: AuthRepository
) : ViewModel() {

    fun bootstrap() {
        if (sessionManager.getToken().isNullOrBlank()) return
        viewModelScope.launch {
            when (authRepository.me().first()) {
                is ApiResult.Success -> Unit
                is ApiResult.Failure -> Unit
            }
        }
    }
}

