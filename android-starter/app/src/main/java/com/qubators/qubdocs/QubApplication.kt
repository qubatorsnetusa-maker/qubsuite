package com.qubators.qubdocs

import android.app.Application
import com.qubators.qubdocs.data.sync.QubSyncWorker

class QubApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        QubSyncWorker.schedulePeriodicSync(this)
    }
}
