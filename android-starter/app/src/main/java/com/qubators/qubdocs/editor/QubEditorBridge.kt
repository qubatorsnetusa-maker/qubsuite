package com.qubators.qubdocs.editor

import android.webkit.JavascriptInterface
import com.qubators.qubdocs.data.models.FormattingState
import kotlinx.serialization.json.Json

interface EditorEventListener {
    fun onEditorReady()
    fun onContentChanged(jsonContent: String)
    fun onFormattingStateChanged(state: FormattingState)
    fun onTitleDetected(title: String)
}

class QubEditorBridge(private val listener: EditorEventListener) {

    private val json = Json { ignoreUnknownKeys = true }

    @JavascriptInterface
    fun onEditorReady() {
        listener.onEditorReady()
    }

    @JavascriptInterface
    fun onContentChanged(jsonString: String) {
        listener.onContentChanged(jsonString)
    }

    @JavascriptInterface
    fun onSelectionChanged(stateJson: String) {
        try {
            val state = json.decodeFromString<FormattingState>(stateJson)
            listener.onFormattingStateChanged(state)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun onTitleDetected(title: String) {
        listener.onTitleDetected(title)
    }
}
