package com.qubators.qubdocs.ui.forms

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class FormQuestion(
    val id: String,
    var questionText: String,
    var questionType: String, // "SHORT_ANSWER", "MULTIPLE_CHOICE", "CHECKBOXES", "RATING"
    var options: MutableList<String> = mutableListOf("Option 1")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QubFormsScreen(
    initialTitle: String,
    initialContentJson: String,
    onBack: () -> Unit,
    onSaveLocally: (title: String, contentJson: String) -> Unit
) {
    var formTitle by remember { mutableStateOf(initialTitle.ifBlank { "Untitled Form" }) }
    var formDescription by remember { mutableStateOf("Form description or instructions for respondents...") }
    var activeTab by remember { mutableIntStateOf(0) } // 0 = Questions, 1 = Responses

    val questions = remember {
        mutableStateListOf(
            FormQuestion("q1", "What is your full name?", "SHORT_ANSWER"),
            FormQuestion("q2", "Which features do you use most?", "CHECKBOXES", mutableListOf("Docs", "Sheets", "Forms", "PDFs")),
            FormQuestion("q3", "Rate your experience with QubDocs", "RATING")
        )
    }

    val primaryPurple = Color(0xFF7C3AED)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(formTitle, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = {
                        onSaveLocally(formTitle, questions.toString())
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        onSaveLocally(formTitle, questions.toString())
                    }) {
                        Icon(Icons.Default.CloudDone, contentDescription = "Save", tint = Color(0xFF10B981))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = primaryPurple,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        },
        floatingActionButton = {
            if (activeTab == 0) {
                FloatingActionButton(
                    onClick = {
                        questions.add(
                            FormQuestion(
                                id = "q_${System.currentTimeMillis()}",
                                questionText = "New Question",
                                questionType = "MULTIPLE_CHOICE",
                                options = mutableListOf("Option 1", "Option 2")
                            )
                        )
                    },
                    containerColor = primaryPurple,
                    contentColor = Color.White
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add Question")
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF1F5F9))
        ) {
            // Form Tabs: Questions vs Responses
            TabRow(
                selectedTabIndex = activeTab,
                containerColor = Color.White,
                contentColor = primaryPurple
            ) {
                Tab(
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    text = { Text("Questions (${questions.size})", fontWeight = FontWeight.SemiBold) }
                )
                Tab(
                    selected = activeTab == 1,
                    onClick = { activeTab = 1 },
                    text = { Text("Responses (14)", fontWeight = FontWeight.SemiBold) }
                )
            }

            if (activeTab == 0) {
                // Questions Builder
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        // Title Header Card
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                OutlinedTextField(
                                    value = formTitle,
                                    onValueChange = { formTitle = it },
                                    label = { Text("Form Title") },
                                    modifier = Modifier.fillMaxWidth(),
                                    textStyle = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = formDescription,
                                    onValueChange = { formDescription = it },
                                    label = { Text("Description") },
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }

                    itemsIndexed(questions) { index, question ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    OutlinedTextField(
                                        value = question.questionText,
                                        onValueChange = { question.questionText = it },
                                        label = { Text("Question ${index + 1}") },
                                        modifier = Modifier.weight(1f)
                                    )
                                    IconButton(onClick = { questions.removeAt(index) }) {
                                        Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = Color.Red)
                                    }
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                when (question.questionType) {
                                    "SHORT_ANSWER" -> {
                                        OutlinedTextField(
                                            value = "",
                                            onValueChange = {},
                                            enabled = false,
                                            placeholder = { Text("Short answer text") },
                                            modifier = Modifier.fillMaxWidth()
                                        )
                                    }

                                    "CHECKBOXES", "MULTIPLE_CHOICE" -> {
                                        question.options.forEachIndexed { optIdx, optText ->
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                modifier = Modifier.padding(vertical = 4.dp)
                                            ) {
                                                Icon(
                                                    imageVector = if (question.questionType == "CHECKBOXES") Icons.Default.CheckBoxOutlineBlank else Icons.Default.RadioButtonUnchecked,
                                                    contentDescription = null,
                                                    tint = Color.Gray
                                                )
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(optText, modifier = Modifier.weight(1f))
                                            }
                                        }
                                    }

                                    "RATING" -> {
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            (1..5).forEach { star ->
                                                Icon(Icons.Default.StarBorder, contentDescription = "$star star", tint = Color(0xFFF59E0B))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // Responses View
                Box(
                    modifier = Modifier.fillMaxSize().padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(Icons.Default.BarChart, contentDescription = null, modifier = Modifier.size(64.dp), tint = primaryPurple)
                            Spacer(modifier = Modifier.height(12.dp))
                            Text("14 Responses Recorded", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Realtime responses, analytics & CSV exports synchronized with Qub Drive.", color = Color.Gray)
                        }
                    }
                }
            }
        }
    }
}
