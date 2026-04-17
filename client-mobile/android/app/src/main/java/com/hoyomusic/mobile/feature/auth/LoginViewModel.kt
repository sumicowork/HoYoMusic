package com.hoyomusic.mobile.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.data.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

data class LoginUiState(
    val identifier: String = "",
    val password: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
    val success: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun updateIdentifier(value: String) {
        _uiState.value = _uiState.value.copy(identifier = value)
    }

    fun updatePassword(value: String) {
        _uiState.value = _uiState.value.copy(password = value)
    }

    fun submit() {
        val current = _uiState.value
        if (current.identifier.isBlank() || current.password.isBlank()) {
            _uiState.value = current.copy(error = "请输入账号和密码")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(submitting = true, error = null)
            when (val result = authRepository.login(current.identifier, current.password).first()) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(submitting = false, success = true)
                is ApiResult.Failure -> _uiState.value = _uiState.value.copy(submitting = false, error = result.error.message)
            }
        }
    }
}

