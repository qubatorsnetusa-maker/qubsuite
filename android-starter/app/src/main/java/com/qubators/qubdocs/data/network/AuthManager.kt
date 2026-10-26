package com.qubators.qubdocs.data.network

import android.content.Context
import android.content.SharedPreferences
import com.qubators.qubdocs.data.models.UserDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class AuthManager private constructor(context: Context) {

    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences(
        "qubdocs_auth_prefs",
        Context.MODE_PRIVATE
    )

    private val json = Json { ignoreUnknownKeys = true }

    private val _isLoggedIn = MutableStateFlow(hasValidToken())
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _currentUser = MutableStateFlow(getSavedUser())
    val currentUser: StateFlow<UserDto?> = _currentUser.asStateFlow()

    fun getToken(): String? {
        return prefs.getString(KEY_TOKEN, null)
    }

    private fun hasValidToken(): Boolean {
        return !getToken().isNullOrBlank()
    }

    fun saveAuth(token: String, user: UserDto) {
        val userJson = json.encodeToString(user)
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER, userJson)
            .apply()

        _currentUser.value = user
        _isLoggedIn.value = true
    }

    fun getSavedUser(): UserDto? {
        val userJson = prefs.getString(KEY_USER, null) ?: return null
        return try {
            json.decodeFromString<UserDto>(userJson)
        } catch (e: Exception) {
            null
        }
    }

    fun logout() {
        prefs.edit().clear().apply()
        _currentUser.value = null
        _isLoggedIn.value = false
    }

    companion object {
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_USER = "user_json"

        @Volatile
        private var INSTANCE: AuthManager? = null

        fun getInstance(context: Context): AuthManager {
            return INSTANCE ?: synchronized(this) {
                val instance = AuthManager(context)
                INSTANCE = instance
                instance
            }
        }
    }
}
