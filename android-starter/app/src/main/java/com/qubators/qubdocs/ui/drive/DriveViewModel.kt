package com.qubators.qubdocs.ui.drive

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.qubators.qubdocs.data.local.DocumentEntity
import com.qubators.qubdocs.data.local.QubDatabase
import com.qubators.qubdocs.data.local.SyncStatus
import com.qubators.qubdocs.data.network.AuthManager
import com.qubators.qubdocs.data.sync.QubSyncWorker
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

class DriveViewModel(application: Application) : AndroidViewModel(application) {

    private val db = QubDatabase.getDatabase(application)
    private val docDao = db.documentDao()
    private val authManager = AuthManager.getInstance(application)

    val documents: StateFlow<List<DocumentEntity>> = docDao.observeAllDocuments()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    fun createNewDocument(title: String = "Untitled", fileType: String = "DOCUMENT", onCreated: (docId: String) -> Unit) {
        viewModelScope.launch {
            val newDoc = DocumentEntity(
                id = UUID.randomUUID().toString(),
                title = title,
                fileType = fileType,
                contentJson = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}",
                syncStatus = SyncStatus.PENDING_CREATE,
                updatedAt = System.currentTimeMillis()
            )
            docDao.upsertDocument(newDoc)
            QubSyncWorker.triggerImmediateSync(getApplication())
            onCreated(newDoc.id)
        }
    }

    fun saveDocumentContent(docId: String, title: String, contentJson: String) {
        viewModelScope.launch {
            val existing = docDao.getDocumentById(docId)
            val syncStatus = if (existing?.syncStatus == SyncStatus.PENDING_CREATE) {
                SyncStatus.PENDING_CREATE
            } else {
                SyncStatus.PENDING_UPDATE
            }
            val updated = DocumentEntity(
                id = docId,
                title = title,
                fileType = existing?.fileType ?: "DOCUMENT",
                contentJson = contentJson,
                syncStatus = syncStatus,
                updatedAt = System.currentTimeMillis()
            )
            docDao.upsertDocument(updated)
            QubSyncWorker.triggerImmediateSync(getApplication())
        }
    }

    fun deleteDocument(docId: String) {
        viewModelScope.launch {
            val existing = docDao.getDocumentById(docId)
            if (existing != null) {
                if (existing.syncStatus == SyncStatus.PENDING_CREATE) {
                    docDao.deleteDocument(docId)
                } else {
                    docDao.upsertDocument(existing.copy(syncStatus = SyncStatus.PENDING_DELETE))
                    QubSyncWorker.triggerImmediateSync(getApplication())
                }
            }
        }
    }

    fun logout() {
        authManager.logout()
    }
}
