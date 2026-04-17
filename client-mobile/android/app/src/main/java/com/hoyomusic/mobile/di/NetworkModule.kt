package com.hoyomusic.mobile.di

import android.content.Context
import android.content.SharedPreferences
import com.hoyomusic.mobile.BuildConfig
import com.hoyomusic.mobile.core.common.NetworkStatusMonitor
import com.hoyomusic.mobile.core.network.ApiClient
import com.hoyomusic.mobile.core.network.AuthNoCacheInterceptor
import com.hoyomusic.mobile.core.network.AuthApi
import com.hoyomusic.mobile.core.network.AuthInterceptor
import com.hoyomusic.mobile.core.network.AuthTokenProvider
import com.hoyomusic.mobile.core.network.CachePolicyInterceptor
import com.hoyomusic.mobile.core.network.HealthApi
import com.hoyomusic.mobile.core.network.OfflineCacheInterceptor
import com.hoyomusic.mobile.core.network.PublicTrackApi
import com.hoyomusic.mobile.core.network.RetryPolicy
import com.hoyomusic.mobile.core.network.VisitorIdInterceptor
import com.hoyomusic.mobile.session.SessionAuthTokenProvider
import com.squareup.moshi.Moshi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import okhttp3.Cache
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.hoyomusic.mobile.core.network.FavoriteApi
import com.hoyomusic.mobile.core.network.PlaylistApi

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideSharedPreferences(@ApplicationContext context: Context): SharedPreferences {
        return runCatching {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                "hoyomusic_mobile_secure",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }.getOrElse {
            context.getSharedPreferences("hoyomusic_mobile_fallback", Context.MODE_PRIVATE)
        }
    }

    @Provides
    @Singleton
    fun provideAuthTokenProvider(provider: SessionAuthTokenProvider): AuthTokenProvider = provider

    @Provides
    @Singleton
    fun provideRetryPolicy(): RetryPolicy = RetryPolicy(baseDelayMs = 700, maxRetries = 2)

    @Provides
    @Singleton
    fun provideCache(@ApplicationContext context: Context): Cache {
        return Cache(java.io.File(context.cacheDir, "http_cache"), 25L * 1024L * 1024L)
    }

    @Provides
    @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder().build()

    @Provides
    @Singleton
    fun provideOkHttpClient(
        visitorIdInterceptor: VisitorIdInterceptor,
        authInterceptor: AuthInterceptor,
        networkStatusMonitor: NetworkStatusMonitor,
        tokenProvider: AuthTokenProvider,
        retryPolicy: RetryPolicy,
        cache: Cache
    ): OkHttpClient {
        val logger = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
        }

        val retryInterceptor = GetRetryInterceptor(retryPolicy)
        val offlineCacheInterceptor = OfflineCacheInterceptor(networkStatusMonitor)
        val authNoCacheInterceptor = AuthNoCacheInterceptor(tokenProvider)
        val cachePolicyInterceptor = CachePolicyInterceptor()

        return OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .cache(cache)
            .addInterceptor(offlineCacheInterceptor)
            .addInterceptor(visitorIdInterceptor)
            .addInterceptor(authInterceptor)
            .addInterceptor(authNoCacheInterceptor)
            .addInterceptor(retryInterceptor)
            .addNetworkInterceptor(cachePolicyInterceptor)
            .addInterceptor(logger)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, moshi: Moshi): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
    }

    @Provides
    @Singleton
    fun provideApiClient(): ApiClient = ApiClient()

    @Provides
    @Singleton
    fun provideHealthApi(retrofit: Retrofit): HealthApi = retrofit.create(HealthApi::class.java)

    @Provides
    @Singleton
    fun providePublicTrackApi(retrofit: Retrofit): PublicTrackApi = retrofit.create(PublicTrackApi::class.java)

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

    @Provides
    @Singleton
    fun provideFavoriteApi(retrofit: Retrofit): FavoriteApi = retrofit.create(FavoriteApi::class.java)

    @Provides
    @Singleton
    fun providePlaylistApi(retrofit: Retrofit): PlaylistApi = retrofit.create(PlaylistApi::class.java)

}

private class GetRetryInterceptor(
    private val retryPolicy: RetryPolicy
) : okhttp3.Interceptor {
    override fun intercept(chain: okhttp3.Interceptor.Chain): Response {
        val request = chain.request()
        var response = chain.proceed(request)

        var tryCount = 0
        while (retryPolicy.shouldRetry(request.method, response.code, tryCount)) {
            response.close()
            val waitMs = retryPolicy.delayFor(tryCount)
            Thread.sleep(waitMs)
            response = chain.proceed(request)
            tryCount += 1
        }
        return response
    }
}
