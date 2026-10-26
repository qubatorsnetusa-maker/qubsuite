package com.qubators.qubdocs.ui.drive

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.qubators.qubdocs.data.local.DocumentEntity
import com.qubators.qubdocs.data.local.SyncStatus
import com.qubators.qubdocs.data.models.UserDto
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriveScreen(
    documents: List<DocumentEntity>,
    currentUser: UserDto?,
    selectedSuiteFilter: String,
    onSelectSuiteFilter: (filter: String) -> Unit,
    onCreateNewDoc: (fileType: String) -> Unit,
    onOpenDoc: (doc: DocumentEntity) -> Unit,
    onDeleteDoc: (docId: String) -> Unit,
    onLogout: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var showProfileMenu by remember { mutableStateOf(false) }
    var showCreateMenu by remember { mutableStateOf(false) }

    val suiteFilters = listOf("ALL", "DOCUMENT", "SPREADSHEET", "FORM", "PDF", "SLIDES")

    val filteredDocs = remember(documents, searchQuery, selectedSuiteFilter) {
        documents.filter { doc ->
            val matchesType = if (selectedSuiteFilter == "ALL") true else doc.fileType == selectedSuiteFilter
            val matchesSearch = if (searchQuery.isBlank()) true else doc.title.contains(searchQuery, ignoreCase = true)
            matchesType && matchesSearch
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("QubDocs", fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color(0xFF2563EB))
                        Spacer(modifier = Modifier.width(6.dp))
                        Surface(
                            color = Color(0xFFDBEAFE),
                            shape = MaterialTheme.shapes.extraSmall
                        ) {
                            Text(
                                text = "Drive",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1D4ED8),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                },
                actions = {
                    Box {
                        IconButton(onClick = { showProfileMenu = true }) {
                            Icon(Icons.Default.AccountCircle, contentDescription = "Account", tint = Color(0xFF2563EB), modifier = Modifier.size(32.dp))
                        }

                        DropdownMenu(
                            expanded = showProfileMenu,
                            onDismissRequest = { showProfileMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(currentUser?.name ?: "Guest User", fontWeight = FontWeight.Bold)
                                        Text(currentUser?.email ?: "Offline mode", fontSize = 12.sp, color = Color.Gray)
                                    }
                                },
                                onClick = {},
                                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) }
                            )
                            HorizontalDivider()
                            DropdownMenuItem(
                                text = { Text("Sign Out", color = Color.Red) },
                                onClick = {
                                    showProfileMenu = false
                                    onLogout()
                                },
                                leadingIcon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = Color.Red) }
                            )
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            Box {
                ExtendedFloatingActionButton(
                    onClick = { showCreateMenu = true },
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("Create New") },
                    containerColor = Color(0xFF2563EB),
                    contentColor = Color.White
                )

                DropdownMenu(
                    expanded = showCreateMenu,
                    onDismissRequest = { showCreateMenu = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("📝 New Document (Docs)") },
                        onClick = { showCreateMenu = false; onCreateNewDoc("DOCUMENT") }
                    )
                    DropdownMenuItem(
                        text = { Text("📊 New Spreadsheet (Sheets)") },
                        onClick = { showCreateMenu = false; onCreateNewDoc("SPREADSHEET") }
                    )
                    DropdownMenuItem(
                        text = { Text("📋 New Form (Forms)") },
                        onClick = { showCreateMenu = false; onCreateNewDoc("FORM") }
                    )
                    DropdownMenuItem(
                        text = { Text("📄 Import PDF (PDFs)") },
                        onClick = { showCreateMenu = false; onCreateNewDoc("PDF") }
                    )
                    DropdownMenuItem(
                        text = { Text("🛝 New Presentation (Slides)") },
                        onClick = { showCreateMenu = false; onCreateNewDoc("SLIDES") }
                    )
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search files across QubDocs...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                shape = MaterialTheme.shapes.medium
            )

            // Suite Filter Chips Strip
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(suiteFilters) { filter ->
                    val isSelected = selectedSuiteFilter == filter
                    FilterChip(
                        selected = isSelected,
                        onClick = { onSelectSuiteFilter(filter) },
                        label = {
                            Text(
                                text = when (filter) {
                                    "ALL" -> "📁 All Files"
                                    "DOCUMENT" -> "📝 Docs"
                                    "SPREADSHEET" -> "📊 Sheets"
                                    "FORM" -> "📋 Forms"
                                    "PDF" -> "📄 PDFs"
                                    "SLIDES" -> "🛝 Slides"
                                    else -> filter
                                },
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFFDBEAFE),
                            selectedLabelColor = Color(0xFF1D4ED8)
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (filteredDocs.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.FolderOpen,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = Color.LightGray
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No files found",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Tap '+ Create New' to start a new document, sheet, or form",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.Gray,
                            fontSize = 13.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 88.dp, start = 16.dp, end = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredDocs, key = { it.id }) { doc ->
                        DocumentRowItem(
                            doc = doc,
                            onClick = { onOpenDoc(doc) },
                            onDelete = { onDeleteDoc(doc.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DocumentRowItem(
    doc: DocumentEntity,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()) }

    val (icon, iconColor) = when (doc.fileType) {
        "SPREADSHEET" -> Pair(Icons.Default.TableChart, Color(0xFF0F766E))
        "FORM" -> Pair(Icons.AutoMirrored.Filled.Assignment, Color(0xFF7C3AED))
        "PDF" -> Pair(Icons.Default.PictureAsPdf, Color(0xFFDC2626))
        "SLIDES" -> Pair(Icons.Default.Slideshow, Color(0xFFEA580C))
        else -> Pair(Icons.AutoMirrored.Filled.Article, Color(0xFF2563EB))
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(36.dp)
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = doc.title.ifBlank { "Untitled" },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )

                Spacer(modifier = Modifier.height(4.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = dateFormat.format(Date(doc.updatedAt)),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.Gray
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    SyncStatusPill(status = doc.syncStatus)
                }
            }

            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Default.DeleteOutline,
                    contentDescription = "Delete",
                    tint = Color.Red
                )
            }
        }
    }
}

@Composable
private fun SyncStatusPill(status: SyncStatus) {
    val (text, color, icon) = when (status) {
        SyncStatus.SYNCED -> Triple("Synced", Color(0xFF10B981), Icons.Default.CloudDone)
        SyncStatus.PENDING_CREATE, SyncStatus.PENDING_UPDATE -> Triple("Offline draft", Color(0xFFF59E0B), Icons.Default.CloudUpload)
        SyncStatus.PENDING_DELETE -> Triple("Deleting...", Color(0xFFEF4444), Icons.Default.CloudOff)
    }

    Surface(
        color = color.copy(alpha = 0.15f),
        shape = MaterialTheme.shapes.extraSmall
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(12.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = text, style = MaterialTheme.typography.labelSmall, color = color)
        }
    }
}
