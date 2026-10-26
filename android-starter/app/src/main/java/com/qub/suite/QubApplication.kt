package com.qub.suite

import android.app.Application
import com.qub.suite.data.sync.QubSyncWorker

class QubApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Schedule periodic background sync when network is reconnected
        QubSyncWorker.schedulePeriodicSync(this)
    }
}
