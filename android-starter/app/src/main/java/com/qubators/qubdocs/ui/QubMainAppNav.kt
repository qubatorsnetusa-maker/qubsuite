package com.qubators.qubdocs.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.qubators.qubdocs.data.local.DocumentEntity
import com.qubators.qubdocs.data.network.AuthManager
import com.qubators.qubdocs.ui.auth.AuthScreen
import com.qubators.qubdocs.ui.drive.DriveScreen
import com.qubators.qubdocs.ui.drive.DriveViewModel
import com.qubators.qubdocs.ui.editor.QubEditorScreen
import com.qubators.qubdocs.ui.forms.QubFormsScreen
import com.qubators.qubdocs.ui.pdf.QubPdfScreen
import com.qubators.qubdocs.ui.sheets.QubSheetsScreen
import com.qubators.qubdocs.ui.slides.QubSlidesScreen

sealed class AppScreen {
    object Auth : AppScreen()
    object Drive : AppScreen()
    data class ActiveDocument(
        val docId: String,
        val title: String,
        val fileType: String,
        val contentJson: String
    ) : AppScreen()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QubMainAppNav(driveViewModel: DriveViewModel = viewModel()) {
    val context = LocalContext.current
    val authManager = remember { AuthManager.getInstance(context) }
    val isLoggedIn by authManager.isLoggedIn.collectAsState()
    val currentUser by authManager.currentUser.collectAsState()

    var isGuestMode by remember { mutableStateOf(false) }
    var currentScreen by remember { mutableStateOf<AppScreen>(if (isLoggedIn) AppScreen.Drive else AppScreen.Auth) }

    var selectedSuiteFilter by remember { mutableStateOf("ALL") }
    val documents by driveViewModel.documents.collectAsState()

    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn) {
            currentScreen = AppScreen.Drive
        } else if (!isGuestMode) {
            currentScreen = AppScreen.Auth
        }
    }

    when (val screen = currentScreen) {
        is AppScreen.Auth -> {
            AuthScreen(
                onLoginSuccess = { token, user ->
                    authManager.saveAuth(token, user)
                    currentScreen = AppScreen.Drive
                },
                onSkipToGuest = {
                    isGuestMode = true
                    currentScreen = AppScreen.Drive
                }
            )
        }

        is AppScreen.ActiveDocument -> {
            when (screen.fileType) {
                "SPREADSHEET" -> {
                    QubSheetsScreen(
                        initialTitle = screen.title,
                        initialContentJson = screen.contentJson,
                        onBack = { currentScreen = AppScreen.Drive },
                        onSaveLocally = { title, content ->
                            driveViewModel.saveDocumentContent(screen.docId, title, content)
                        }
                    )
                }

                "FORM" -> {
                    QubFormsScreen(
                        initialTitle = screen.title,
                        initialContentJson = screen.contentJson,
                        onBack = { currentScreen = AppScreen.Drive },
                        onSaveLocally = { title, content ->
                            driveViewModel.saveDocumentContent(screen.docId, title, content)
                        }
                    )
                }

                "PDF" -> {
                    QubPdfScreen(
                        initialTitle = screen.title,
                        onBack = { currentScreen = AppScreen.Drive }
                    )
                }

                "SLIDES" -> {
                    QubSlidesScreen(
                        initialTitle = screen.title,
                        onBack = { currentScreen = AppScreen.Drive }
                    )
                }

                else -> {
                    // Default Docs Editor
                    QubEditorScreen(
                        initialTitle = screen.title,
                        initialContentJson = screen.contentJson,
                        onBack = { currentScreen = AppScreen.Drive },
                        onSaveLocally = { title, content ->
                            driveViewModel.saveDocumentContent(screen.docId, title, content)
                        }
                    )
                }
            }
        }

        is AppScreen.Drive -> {
            Scaffold(
                bottomBar = {
                    NavigationBar(containerColor = Color.White) {
                        NavigationBarItem(
                            selected = selectedSuiteFilter == "DOCUMENT",
                            onClick = { selectedSuiteFilter = "DOCUMENT" },
                            icon = { Icon(Icons.AutoMirrored.Filled.Article, contentDescription = null) },
                            label = { Text("Docs") }
                        )
                        NavigationBarItem(
                            selected = selectedSuiteFilter == "SPREADSHEET",
                            onClick = { selectedSuiteFilter = "SPREADSHEET" },
                            icon = { Icon(Icons.Default.TableChart, contentDescription = null) },
                            label = { Text("Sheets") }
                        )
                        NavigationBarItem(
                            selected = selectedSuiteFilter == "FORM",
                            onClick = { selectedSuiteFilter = "FORM" },
                            icon = { Icon(Icons.AutoMirrored.Filled.Assignment, contentDescription = null) },
                            label = { Text("Forms") }
                        )
                        NavigationBarItem(
                            selected = selectedSuiteFilter == "PDF",
                            onClick = { selectedSuiteFilter = "PDF" },
                            icon = { Icon(Icons.Default.PictureAsPdf, contentDescription = null) },
                            label = { Text("PDFs") }
                        )
                        NavigationBarItem(
                            selected = selectedSuiteFilter == "SLIDES",
                            onClick = { selectedSuiteFilter = "SLIDES" },
                            icon = { Icon(Icons.Default.Slideshow, contentDescription = null) },
                            label = { Text("Slides") }
                        )
                        NavigationBarItem(
                            selected = selectedSuiteFilter == "ALL",
                            onClick = { selectedSuiteFilter = "ALL" },
                            icon = { Icon(Icons.Default.Folder, contentDescription = null) },
                            label = { Text("Drive") }
                        )
                    }
                }
            ) { innerPadding ->
                Surface(modifier = Modifier.padding(innerPadding)) {
                    DriveScreen(
                        documents = documents,
                        currentUser = currentUser,
                        selectedSuiteFilter = selectedSuiteFilter,
                        onSelectSuiteFilter = { selectedSuiteFilter = it },
                        onCreateNewDoc = { fileType ->
                            val defaultTitle = when (fileType) {
                                "SPREADSHEET" -> "Untitled Spreadsheet"
                                "FORM" -> "Untitled Form"
                                "PDF" -> "Imported PDF"
                                "SLIDES" -> "Untitled Presentation"
                                else -> "Untitled Document"
                            }
                            driveViewModel.createNewDocument(defaultTitle, fileType) { newDocId ->
                                currentScreen = AppScreen.ActiveDocument(
                                    docId = newDocId,
                                    title = defaultTitle,
                                    fileType = fileType,
                                    contentJson = ""
                                )
                            }
                        },
                        onOpenDoc = { doc ->
                            currentScreen = AppScreen.ActiveDocument(
                                docId = doc.id,
                                title = doc.title,
                                fileType = doc.fileType,
                                contentJson = doc.contentJson
                            )
                        },
                        onDeleteDoc = { docId ->
                            driveViewModel.deleteDocument(docId)
                        },
                        onLogout = {
                            driveViewModel.logout()
                            isGuestMode = false
                            currentScreen = AppScreen.Auth
                        }
                    )
                }
            }
        }
    }
}
