package com.qubators.qubdocs.ui.editor

import android.annotation.SuppressLint
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Redo
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader
import com.qubators.qubdocs.data.models.FormattingState
import com.qubators.qubdocs.editor.EditorEventListener
import com.qubators.qubdocs.editor.QubEditorBridge

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QubEditorScreen(
    initialTitle: String,
    initialContentJson: String,
    onBack: () -> Unit,
    onSaveLocally: (title: String, contentJson: String) -> Unit
) {
    var title by remember { mutableStateOf(initialTitle) }
    var currentContent by remember { mutableStateOf(initialContentJson) }
    var formattingState by remember { mutableStateOf(FormattingState()) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var isEditorReady by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = title.ifBlank { "Untitled document" },
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1
                    )
                },
                navigationIcon = {
                    IconButton(onClick = {
                        onSaveLocally(title, currentContent)
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        onSaveLocally(title, currentContent)
                    }) {
                        Icon(Icons.Default.CloudDone, contentDescription = "Saved", tint = Color(0xFF10B981))
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                tonalElevation = 3.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .imePadding()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    ToolbarButton(
                        icon = Icons.Default.FormatBold,
                        active = formattingState.isBold,
                        onClick = { webViewRef?.evaluateJavascript("window.QubMobileBridge.toggleBold()", null) }
                    )
                    ToolbarButton(
                        icon = Icons.Default.FormatItalic,
                        active = formattingState.isItalic,
                        onClick = { webViewRef?.evaluateJavascript("window.QubMobileBridge.toggleItalic()", null) }
                    )
                    ToolbarButton(
                        icon = Icons.Default.FormatStrikethrough,
                        active = formattingState.isStrike,
                        onClick = { webViewRef?.evaluateJavascript("window.QubMobileBridge.toggleStrike()", null) }
                    )

                    VerticalDivider(modifier = Modifier.height(24.dp).padding(horizontal = 4.dp))

                    ToolbarButton(
                        icon = Icons.Default.Title,
                        active = formattingState.isHeading1,
                        onClick = { webViewRef?.evaluateJavascript("window.QubMobileBridge.toggleHeading(1)", null) }
                    )
                    ToolbarButton(
                        icon = Icons.Default.FormatListBulleted,
                        active = formattingState.isBulletList,
                        onClick = { webViewRef?.evaluateJavascript("window.QubMobileBridge.toggleBulletList()", null) }
                    )
                    ToolbarButton(
                        icon = Icons.Default.Checklist,
                        active = formattingState.isTaskList,
                        onClick = { webViewRef?.evaluateJavascript("window.QubMobileBridge.toggleTaskList()", null) }
                    )

                    VerticalDivider(modifier = Modifier.height(24.dp).padding(horizontal = 4.dp))

                    IconButton(
                        enabled = formattingState.canUndo,
                        onClick = { webViewRef?.evaluateJavascript("window.QubMobileBridge.undo()", null) }
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Undo, contentDescription = "Undo")
                    }
                    IconButton(
                        enabled = formattingState.canRedo,
                        onClick = { webViewRef?.evaluateJavascript("window.QubMobileBridge.redo()", null) }
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Redo, contentDescription = "Redo")
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            QubEditorNativeView(
                modifier = Modifier.fillMaxSize(),
                onWebViewCreated = { webView ->
                    webViewRef = webView
                },
                listener = object : EditorEventListener {
                    override fun onEditorReady() {
                        isEditorReady = true
                        if (initialContentJson.isNotBlank()) {
                            val escaped = initialContentJson
                                .replace("\\", "\\\\")
                                .replace("'", "\\'")
                                .replace("\n", "\\n")
                            webViewRef?.evaluateJavascript("window.QubMobileBridge.setContent('$escaped')", null)
                        }
                    }

                    override fun onContentChanged(jsonContent: String) {
                        currentContent = jsonContent
                        onSaveLocally(title, jsonContent)
                    }

                    override fun onFormattingStateChanged(state: FormattingState) {
                        formattingState = state
                    }

                    override fun onTitleDetected(detectedTitle: String) {
                        if (title.isBlank() || title == "Untitled document") {
                            title = detectedTitle
                        }
                    }
                }
            )
        }
    }
}

@Composable
private fun ToolbarButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    active: Boolean,
    onClick: () -> Unit
) {
    FilledIconToggleButton(
        checked = active,
        onCheckedChange = { onClick() },
        colors = IconButtonDefaults.filledIconToggleButtonColors(
            checkedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            checkedContentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            containerColor = Color.Transparent,
            contentColor = MaterialTheme.colorScheme.onSurfaceVariant
        ),
        modifier = Modifier.size(38.dp)
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp))
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun QubEditorNativeView(
    modifier: Modifier = Modifier,
    onWebViewCreated: (WebView) -> Unit,
    listener: EditorEventListener
) {
    AndroidView(
        modifier = modifier,
        factory = { context ->
            val assetLoader = WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
                .build()

            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = false
                settings.allowContentAccess = false

                addJavascriptInterface(QubEditorBridge(listener), "AndroidBridge")

                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest
                    ): WebResourceResponse? {
                        return assetLoader.shouldInterceptRequest(request.url)
                    }
                }

                onWebViewCreated(this)
                loadUrl("https://appassets.androidplatform.net/assets/qub-editor/mobile-editor.html")
            }
        }
    )
}
