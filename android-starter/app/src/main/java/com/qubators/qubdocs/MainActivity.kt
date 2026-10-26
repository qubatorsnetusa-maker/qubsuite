package com.qubators.qubdocs

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.view.View
import android.webkit.*
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.io.ByteArrayInputStream

class MainActivity : ComponentActivity() {

    companion object {
        const val DEFAULT_URL = "https://docs.qubdocs.online/drive"
    }

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var webViewRef: WebView? = null

    // Native Android file chooser for document upload, photo signatures, and attachments
    private val filePickerLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (filePathCallback == null) return@registerForActivityResult
            val results: Array<Uri>? = when {
                result.resultCode == RESULT_OK && result.data != null -> {
                    val dataString = result.data?.dataString
                    val clipData = result.data?.clipData
                    when {
                        clipData != null -> Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                        dataString != null -> arrayOf(Uri.parse(dataString))
                        else -> null
                    }
                }
                else -> null
            }
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val initialUrl = parseDeepLink(intent) ?: DEFAULT_URL

        // Handle Android system back gesture to navigate WebView history
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webViewRef?.canGoBack() == true) {
                    webViewRef?.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        setContent {
            MaterialTheme {
                QubAppView(
                    targetUrl = initialUrl,
                    onWebViewCreated = { webViewRef = it },
                    onOpenFileChooser = { callback, intent ->
                        filePathCallback = callback
                        filePickerLauncher.launch(intent)
                    }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        parseDeepLink(intent)?.let { deepLinkUrl ->
            webViewRef?.loadUrl(deepLinkUrl)
        }
    }

    private fun parseDeepLink(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        return when {
            uri.scheme.equals("qubdocs", ignoreCase = true) -> {
                // e.g. qubdocs://verify-email?token=xyz -> https://docs.qubdocs.online/verify-email?token=xyz
                val pathAndQuery = uri.toString().removePrefix("qubdocs://").removePrefix("/")
                "https://docs.qubdocs.online/$pathAndQuery"
            }
            uri.host?.contains("qubdocs.online", ignoreCase = true) == true -> {
                uri.toString()
            }
            else -> null
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Composable
    private fun QubAppView(
        targetUrl: String,
        onWebViewCreated: (WebView) -> Unit,
        onOpenFileChooser: (ValueCallback<Array<Uri>>, Intent) -> Unit
    ) {
        var isNetworkError by remember { mutableStateOf(false) }
        var currentWebview by remember { mutableStateOf<WebView?>(null) }
        var popupWebView by remember { mutableStateOf<WebView?>(null) }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White)
                .statusBarsPadding()
                .navigationBarsPadding()
        ) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        setLayerType(View.LAYER_TYPE_HARDWARE, null)

                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            databaseEnabled = true
                            allowFileAccess = true
                            allowContentAccess = true
                            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            cacheMode = WebSettings.LOAD_DEFAULT
                            useWideViewPort = true
                            loadWithOverviewMode = true
                            setSupportZoom(true)
                            builtInZoomControls = false
                            displayZoomControls = false
                            setSupportMultipleWindows(true)
                            javaScriptCanOpenWindowsAutomatically = true
                            userAgentString = "$userAgentString QubDocsAndroid/1.0"
                        }

                        val cookieManager = CookieManager.getInstance()
                        cookieManager.setAcceptCookie(true)
                        cookieManager.setAcceptThirdPartyCookies(this, true)

                        setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
                            try {
                                val request = DownloadManager.Request(Uri.parse(url)).apply {
                                    setMimeType(mimetype)
                                    addRequestHeader("User-Agent", userAgent)
                                    val cookies = CookieManager.getInstance().getCookie(url)
                                    if (!cookies.isNullOrBlank()) {
                                        addRequestHeader("Cookie", cookies)
                                    }
                                    setDescription("Downloading document from Qub Suite…")
                                    val filename = URLUtil.guessFileName(url, contentDisposition, mimetype)
                                    setTitle(filename)
                                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                                }
                                val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                                dm.enqueue(request)
                                Toast.makeText(context, "Download started…", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Download failed: ${e.message}", Toast.LENGTH_SHORT).show()
                            }
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onShowFileChooser(
                                webView: WebView?,
                                filePathCallback: ValueCallback<Array<Uri>>?,
                                fileChooserParams: FileChooserParams?
                            ): Boolean {
                                if (filePathCallback == null) return false
                                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                    type = "*/*"
                                    addCategory(Intent.CATEGORY_OPENABLE)
                                }
                                onOpenFileChooser(filePathCallback, intent)
                                return true
                            }

                            // Support popup windows for KingsChat OAuth consent
                            override fun onCreateWindow(
                                view: WebView?,
                                isDialog: Boolean,
                                isUserGesture: Boolean,
                                resultMsg: Message?
                            ): Boolean {
                                if (resultMsg == null) return false

                                val childWebView = WebView(context).apply {
                                    settings.apply {
                                        javaScriptEnabled = true
                                        domStorageEnabled = true
                                        databaseEnabled = true
                                        setSupportMultipleWindows(true)
                                        javaScriptCanOpenWindowsAutomatically = true
                                        userAgentString = "$userAgentString QubDocsAndroid/1.0"
                                    }
                                    val childCookieManager = CookieManager.getInstance()
                                    childCookieManager.setAcceptCookie(true)
                                    childCookieManager.setAcceptThirdPartyCookies(this, true)

                                    webChromeClient = object : WebChromeClient() {
                                        override fun onCloseWindow(window: WebView?) {
                                            window?.destroy()
                                            popupWebView = null
                                        }
                                    }

                                    webViewClient = object : WebViewClient() {
                                        override fun shouldOverrideUrlLoading(
                                            view: WebView?,
                                            request: WebResourceRequest?
                                        ): Boolean {
                                            val url = request?.url?.toString() ?: return false
                                            val host = request.url?.host ?: ""
                                            // Keep KingsChat and Qub inside the popup dialog
                                            return if (host.contains("kingsch.at") || host.contains("kingschat") || host.contains("qubdocs.online")) {
                                                false
                                            } else {
                                                try {
                                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                                    true
                                                } catch (_: Exception) {
                                                    false
                                                }
                                            }
                                        }
                                    }
                                }

                                val transport = resultMsg.obj as? WebView.WebViewTransport
                                transport?.webView = childWebView
                                resultMsg.sendToTarget()

                                popupWebView = childWebView
                                return true
                            }

                            override fun onCloseWindow(window: WebView?) {
                                window?.destroy()
                                popupWebView = null
                            }
                        }

                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                isNetworkError = false
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                CookieManager.getInstance().flush()
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: WebResourceError?
                            ) {
                                if (request?.isForMainFrame == true) {
                                    isNetworkError = true
                                }
                            }

                            override fun shouldInterceptRequest(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): WebResourceResponse? {
                                return interceptLocalAssets(request)
                            }

                            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                val url = request?.url?.toString() ?: return false
                                val host = request.url?.host ?: ""
                                // Keep internal qubdocs URLs AND KingsChat login inside the app
                                return if (host.contains("qubdocs.online") || host.contains("kingsch.at") || host.contains("kingschat") || host.contains("localhost") || host.contains("10.0.2.2")) {
                                    false
                                } else {
                                    try {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                        true
                                    } catch (_: Exception) {
                                        false
                                    }
                                }
                            }
                        }

                        currentWebview = this
                        onWebViewCreated(this)
                        loadUrl(targetUrl)
                    }
                }
            )

            // KingsChat OAuth Popup In-App Dialog
            popupWebView?.let { popupView ->
                Dialog(
                    onDismissRequest = {
                        popupView.destroy()
                        popupWebView = null
                    },
                    properties = DialogProperties(
                        usePlatformDefaultWidth = false,
                        dismissOnBackPress = true,
                        dismissOnClickOutside = false
                    )
                ) {
                    Surface(
                        modifier = Modifier
                            .fillMaxSize()
                            .statusBarsPadding()
                            .navigationBarsPadding(),
                        color = Color.White
                    ) {
                        Column(modifier = Modifier.fillMaxSize()) {
                            // Header bar with Close button
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .background(Color(0xFFF1F5F9))
                                    .padding(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "KingsChat Sign In",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp,
                                    color = Color(0xFF0F172A)
                                )
                                IconButton(
                                    onClick = {
                                        popupView.destroy()
                                        popupWebView = null
                                    },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Close",
                                        tint = Color(0xFF64748B)
                                    )
                                }
                            }

                            // The popup WebView where KingsChat renders
                            AndroidView(
                                modifier = Modifier.fillMaxSize(),
                                factory = { popupView }
                            )
                        }
                    }
                }
            }

            // Offline / Fatal Error Fallback Screen
            if (isNetworkError) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFFF8FAFC)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Surface(
                            modifier = Modifier.size(72.dp),
                            shape = RoundedCornerShape(20.dp),
                            color = Color(0xFFEFF6FF)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.WifiOff,
                                    contentDescription = null,
                                    tint = Color(0xFF2563EB),
                                    modifier = Modifier.size(36.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "Connection Offline",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )

                        Text(
                            text = "Unable to connect to Qub Suite. Check your Wi-Fi or mobile data and try again.",
                            fontSize = 14.sp,
                            color = Color(0xFF64748B),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = {
                                isNetworkError = false
                                currentWebview?.reload()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A73E8)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.height(48.dp)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Retry", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }

    private fun interceptLocalAssets(request: WebResourceRequest?): WebResourceResponse? {
        val reqUri = request?.url ?: return null
        val reqHost = reqUri.host ?: ""
        val reqPath = reqUri.path ?: "/"

        // Only intercept requests destined for Qub Suite domains or local dev
        val isAppDomain = reqHost.endsWith("qubdocs.online", ignoreCase = true) ||
                reqHost.equals("localhost", ignoreCase = true) ||
                reqHost.equals("10.0.2.2", ignoreCase = true)

        if (!isAppDomain) {
            return null // External requests go directly over the network
        }

        // Pass through backend API calls to the live server
        if (reqPath.startsWith("/api/")) {
            if (!isOnline(this)) {
                val offlineJson = """{"error":"offline","message":"Device is offline"}"""
                val headers = mapOf(
                    "Content-Type" to "application/json",
                    "Access-Control-Allow-Origin" to "*"
                )
                return WebResourceResponse(
                    "application/json",
                    "UTF-8",
                    503,
                    "Service Unavailable (Offline)",
                    headers,
                    ByteArrayInputStream(offlineJson.toByteArray(Charsets.UTF_8))
                )
            }
            return null
        }

        // Clean relative path without leading slash
        val relativePath = reqPath.trimStart('/')
        val assetPath = if (relativePath.isEmpty()) "www/index.html" else "www/$relativePath"

        val responseHeaders = mapOf(
            "Access-Control-Allow-Origin" to "*",
            "Cache-Control" to "no-cache"
        )

        try {
            val stream = assets.open(assetPath)
            val mime = getMimeType(assetPath)
            return WebResourceResponse(mime, "UTF-8", 200, "OK", responseHeaders, stream)
        } catch (_: Exception) {
            // Not found as a direct file in assets
        }

        // For SPA routes or main frame navigation, return www/index.html
        val hasExtension = relativePath.substringAfterLast('/', relativePath).contains('.')
        if (!hasExtension || request.isForMainFrame) {
            try {
                val htmlStream = assets.open("www/index.html")
                return WebResourceResponse("text/html", "UTF-8", 200, "OK", responseHeaders, htmlStream)
            } catch (_: Exception) {
                return null
            }
        }

        return WebResourceResponse(
            "text/plain",
            "UTF-8",
            404,
            "Not Found",
            responseHeaders,
            ByteArrayInputStream("Asset not found".toByteArray(Charsets.UTF_8))
        )
    }

    private fun getMimeType(filePath: String): String {
        return when {
            filePath.endsWith(".html") -> "text/html"
            filePath.endsWith(".js") || filePath.endsWith(".mjs") -> "text/javascript"
            filePath.endsWith(".css") -> "text/css"
            filePath.endsWith(".json") || filePath.endsWith(".map") -> "application/json"
            filePath.endsWith(".svg") -> "image/svg+xml"
            filePath.endsWith(".png") -> "image/png"
            filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") -> "image/jpeg"
            filePath.endsWith(".webp") -> "image/webp"
            filePath.endsWith(".gif") -> "image/gif"
            filePath.endsWith(".woff2") -> "font/woff2"
            filePath.endsWith(".woff") -> "font/woff"
            filePath.endsWith(".ttf") -> "font/ttf"
            filePath.endsWith(".pdf") -> "application/pdf"
            filePath.endsWith(".ico") -> "image/x-icon"
            filePath.endsWith(".wasm") -> "application/wasm"
            filePath.endsWith(".xml") -> "application/xml"
            else -> "application/octet-stream"
        }
    }

    private fun isOnline(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
