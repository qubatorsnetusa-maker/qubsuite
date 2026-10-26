package com.qub.suite.ui

import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.qub.suite.data.local.DocumentEntity
import com.qub.suite.ui.drive.DriveScreen
import com.qub.suite.ui.drive.DriveViewModel

sealed class Screen {
    object Drive : Screen()
    data class Editor(val docId: String, val title: String, val contentJson: String) : Screen()
}

@Composable
fun QubAppNav(driveViewModel: DriveViewModel = viewModel()) {
    var currentScreen by remember { mutableStateOf<Screen>(Screen.Drive) }
    val documents by driveViewModel.documents.collectAsState()

    when (val screen = currentScreen) {
        is Screen.Drive -> {
            DriveScreen(
                documents = documents,
                onCreateNewDoc = {
                    driveViewModel.createNewDocument { newDocId ->
                        currentScreen = Screen.Editor(
                            docId = newDocId,
                            title = "Untitled document",
                            contentJson = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}"
                        )
                    }
                },
                onOpenDoc = { docId, title, contentJson ->
                    currentScreen = Screen.Editor(docId, title, contentJson)
                },
                onDeleteDoc = { docId ->
                    driveViewModel.deleteDocument(docId)
                }
            )
        }

        is Screen.Editor -> {
            QubEditorScreen(
                initialTitle = screen.title,
                initialContentJson = screen.contentJson,
                onBack = {
                    currentScreen = Screen.Drive
                },
                onSaveLocally = { updatedTitle, updatedContentJson ->
                    driveViewModel.saveDocumentContent(screen.docId, updatedTitle, updatedContentJson)
                }
            )
        }
    }
}
