package com.qub.suite.data.sync

import android.content.Context
import androidx.work.*
import com.qub.suite.data.local.QubDatabase
import com.qub.suite.data.local.SyncStatus
import com.qub.suite.data.models.CreateDocumentRequestDto
import com.qub.suite.data.models.UpdateDocumentRequestDto
import com.qub.suite.data.network.NetworkClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class QubSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val database = QubDatabase.getDatabase(applicationContext)
            val api = NetworkClient.createService(
                baseUrl = "http://10.0.2.2:4100/",
                tokenProvider = { null }
            )

            val pendingDocs = database.documentDao().getPendingSyncDocuments()

            for (doc in pendingDocs) {
                when (doc.syncStatus) {
                    SyncStatus.PENDING_CREATE -> {
                        val response = api.createDocument(
                            CreateDocumentRequestDto(
                                title = doc.title,
                                folderId = doc.folderId,
                                contentJson = doc.contentJson
                            )
                        )
                        database.documentDao().upsertDocument(
                            doc.copy(id = response.id, syncStatus = SyncStatus.SYNCED)
                        )
                    }

                    SyncStatus.PENDING_UPDATE -> {
                        api.updateDocument(
                            doc.id,
                            UpdateDocumentRequestDto(
                                title = doc.title,
                                contentJson = doc.contentJson
                            )
                        )
                        database.documentDao().upsertDocument(
                            doc.copy(syncStatus = SyncStatus.SYNCED)
                        )
                    }

                    SyncStatus.PENDING_DELETE -> {
                        api.deleteFile(doc.id)
                        database.documentDao().deleteDocument(doc.id)
                    }

                    SyncStatus.SYNCED -> {}
                }
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val SYNC_WORK_NAME = "qub_offline_sync"

        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<QubSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                SYNC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun triggerImmediateSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<QubSyncWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueue(request)
        }
    }
}
