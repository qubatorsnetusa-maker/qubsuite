package com.qubators.qubdocs.data.local

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

enum class SyncStatus {
    SYNCED,
    PENDING_CREATE,
    PENDING_UPDATE,
    PENDING_DELETE
}

@Entity(tableName = "documents")
data class DocumentEntity(
    @PrimaryKey val id: String,
    val title: String,
    val contentJson: String,
    val fileType: String = "DOCUMENT", // DOCUMENT, SPREADSHEET, FORM, PDF, SLIDES
    val folderId: String? = null,
    val updatedAt: Long = System.currentTimeMillis(),
    val syncStatus: SyncStatus = SyncStatus.SYNCED
)

@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey(autoGenerate = true) val queueId: Long = 0,
    val action: String, // "CREATE_DOC", "UPDATE_DOC", "RENAME_DOC", "DELETE_DOC"
    val targetId: String,
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Dao
interface DocumentDao {
    @Query("SELECT * FROM documents WHERE syncStatus != 'PENDING_DELETE' ORDER BY updatedAt DESC")
    fun observeAllDocuments(): Flow<List<DocumentEntity>>

    @Query("SELECT * FROM documents WHERE syncStatus != 'PENDING_DELETE' AND fileType = :type ORDER BY updatedAt DESC")
    fun observeDocumentsByType(type: String): Flow<List<DocumentEntity>>

    @Query("SELECT * FROM documents WHERE id = :docId LIMIT 1")
    suspend fun getDocumentById(docId: String): DocumentEntity?

    @Query("SELECT * FROM documents WHERE id = :docId LIMIT 1")
    fun observeDocumentById(docId: String): Flow<DocumentEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDocument(document: DocumentEntity)

    @Query("UPDATE documents SET title = :title, contentJson = :content, updatedAt = :updatedAt, syncStatus = :status WHERE id = :id")
    suspend fun updateContent(id: String, title: String, content: String, updatedAt: Long, status: SyncStatus)

    @Query("SELECT * FROM documents WHERE syncStatus != 'SYNCED'")
    suspend fun getPendingSyncDocuments(): List<DocumentEntity>

    @Query("DELETE FROM documents WHERE id = :docId")
    suspend fun deleteDocument(docId: String)
}

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM sync_queue ORDER BY queueId ASC")
    suspend fun getPendingQueue(): List<SyncQueueEntity>

    @Insert
    suspend fun enqueueAction(action: SyncQueueEntity)

    @Delete
    suspend fun removeAction(action: SyncQueueEntity)

    @Query("DELETE FROM sync_queue WHERE targetId = :targetId")
    suspend fun clearActionsForTarget(targetId: String)
}

@Database(
    entities = [DocumentEntity::class, SyncQueueEntity::class],
    version = 1,
    exportSchema = false
)
abstract class QubDatabase : RoomDatabase() {
    abstract fun documentDao(): DocumentDao
    abstract fun syncQueueDao(): SyncQueueDao

    companion object {
        @Volatile
        private var INSTANCE: QubDatabase? = null

        fun getDatabase(context: Context): QubDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    QubDatabase::class.java,
                    "qubdocs_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
