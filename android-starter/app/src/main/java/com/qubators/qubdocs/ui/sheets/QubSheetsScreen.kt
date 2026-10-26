package com.qubators.qubdocs.ui.sheets

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QubSheetsScreen(
    initialTitle: String,
    initialContentJson: String,
    onBack: () -> Unit,
    onSaveLocally: (title: String, contentJson: String) -> Unit
) {
    var title by remember { mutableStateOf(initialTitle.ifBlank { "Untitled Spreadsheet" }) }
    var selectedCell by remember { mutableStateOf("A1") }
    var formulaInput by remember { mutableStateOf("") }

    // Grid matrix 15 rows x 6 cols (A-F)
    val columns = listOf("A", "B", "C", "D", "E", "F")
    val gridState = remember {
        mutableStateMapOf<String, String>(
            "A1" to "Category", "B1" to "Amount", "C1" to "Status",
            "A2" to "Development", "B2" to "2500", "C2" to "Approved",
            "A3" to "Design", "B3" to "1200", "C3" to "Pending",
            "A4" to "Hosting", "B4" to "450", "C4" to "Approved",
            "A5" to "Total", "B5" to "=SUM(B2:B4)", "C5" to "Calculated"
        )
    }

    LaunchedEffect(selectedCell) {
        formulaInput = gridState[selectedCell] ?: ""
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = title, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = {
                        onSaveLocally(title, gridState.toMap().toString())
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        onSaveLocally(title, gridState.toMap().toString())
                    }) {
                        Icon(Icons.Default.CloudDone, contentDescription = "Save", tint = Color(0xFF10B981))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0F766E), titleContentColor = Color.White, navigationIconContentColor = Color.White, actionIconContentColor = Color.White)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Formula Bar
            Surface(
                tonalElevation = 2.dp,
                color = Color(0xFFF1F5F9),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = selectedCell,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F766E),
                        modifier = Modifier
                            .background(Color.White, shape = MaterialTheme.shapes.extraSmall)
                            .padding(horizontal = 8.dp, vertical = 6.dp)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    Text(text = "fx", fontWeight = FontWeight.Bold, color = Color.Gray)

                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedTextField(
                        value = formulaInput,
                        onValueChange = {
                            formulaInput = it
                            gridState[selectedCell] = it
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        singleLine = true,
                        placeholder = { Text("Enter value or formula...") }
                    )
                }
            }

            // Grid Layout
            Row(
                modifier = Modifier
                    .weight(1f)
                    .horizontalScroll(rememberScrollState())
            ) {
                Column {
                    // Header Row (Columns A..F)
                    Row {
                        Box(
                            modifier = Modifier
                                .size(width = 40.dp, height = 36.dp)
                                .background(Color(0xFFE2E8F0))
                                .border(0.5.dp, Color(0xFFCBD5E1)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("#", fontSize = 12.sp, color = Color.DarkGray)
                        }

                        columns.forEach { col ->
                            Box(
                                modifier = Modifier
                                    .size(width = 100.dp, height = 36.dp)
                                    .background(Color(0xFFE2E8F0))
                                    .border(0.5.dp, Color(0xFFCBD5E1)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(col, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }
                    }

                    // Grid Data Rows (1..15)
                    LazyColumn {
                        itemsIndexed((1..20).toList()) { _, rowIdx ->
                            val rowNum = rowIdx
                            Row {
                                Box(
                                    modifier = Modifier
                                        .size(width = 40.dp, height = 38.dp)
                                        .background(Color(0xFFF8FAFC))
                                        .border(0.5.dp, Color(0xFFCBD5E1)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("$rowNum", fontSize = 12.sp, color = Color.DarkGray)
                                }

                                columns.forEach { col ->
                                    val cellId = "$col$rowNum"
                                    val cellValue = gridState[cellId] ?: ""
                                    val isSelected = selectedCell == cellId

                                    Box(
                                        modifier = Modifier
                                            .size(width = 100.dp, height = 38.dp)
                                            .background(if (isSelected) Color(0xFFCCFBF1) else Color.White)
                                            .border(
                                                width = if (isSelected) 2.dp else 0.5.dp,
                                                color = if (isSelected) Color(0xFF0F766E) else Color(0xFFE2E8F0)
                                            )
                                            .clickable { selectedCell = cellId },
                                        contentAlignment = Alignment.CenterStart
                                    ) {
                                        Text(
                                            text = if (cellValue == "=SUM(B2:B4)") "4150" else cellValue,
                                            fontSize = 13.sp,
                                            fontWeight = if (rowNum == 1 || cellId == "A5") FontWeight.Bold else FontWeight.Normal,
                                            modifier = Modifier.padding(horizontal = 6.dp),
                                            maxLines = 1
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Sheet Tabs Bar
            Surface(
                color = Color(0xFFE2E8F0),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding( horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add sheet", tint = Color(0xFF0F766E))
                    Spacer(modifier = Modifier.width(12.dp))
                    Surface(
                        color = Color.White,
                        shape = MaterialTheme.shapes.extraSmall
                    ) {
                        Text(
                            text = "Sheet1",
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F766E),
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }
            }
        }
    }
}
