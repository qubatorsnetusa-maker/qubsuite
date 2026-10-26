package com.qub.suite.data.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.qub.suite.data.models.*
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.http.*
import java.util.concurrent.TimeUnit

interface QubApiService {
    @GET("api/drive/recent")
    suspend fun getRecentFiles(@Query("limit") limit: Int = 20): DriveResponseDto

    @GET("api/drive")
    suspend fun listFolder(
        @Query("folderId") folderId: String? = null,
        @Query("cursor") cursor: String? = null
    ): DriveResponseDto

    @GET("api/docs/{id}")
    suspend fun getDocument(@Path("id") docId: String): FileItemDto

    @POST("api/docs")
    suspend fun createDocument(@Body request: CreateDocumentRequestDto): FileItemDto

    @PATCH("api/docs/{id}")
    suspend fun updateDocument(
        @Path("id") docId: String,
        @Body request: UpdateDocumentRequestDto
    ): FileItemDto

    @DELETE("api/drive/{id}")
    suspend fun deleteFile(@Path("id") fileId: String)
}

class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = tokenProvider()

        val request = if (!token.isNullOrBlank()) {
            original.newBuilder()
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .build()
        } else {
            original.newBuilder()
                .header("Accept", "application/json")
                .build()
        }

        return chain.proceed(request)
    }
}

object NetworkClient {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    fun createService(baseUrl: String, tokenProvider: () -> String?): QubApiService {
        val formattedUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenProvider))
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        val contentType = "application/json".toMediaType()

        return Retrofit.Builder()
            .baseUrl(formattedUrl)
            .client(client)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
            .create(QubApiService::class.java)
    }
}
