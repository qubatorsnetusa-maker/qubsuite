package com.qubators.qubdocs.ui.slides

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class SlideData(
    val id: Int,
    var slideTitle: String,
    var slideSubtitle: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QubSlidesScreen(
    initialTitle: String,
    onBack: () -> Unit
) {
    var title by remember { mutableStateOf(initialTitle.ifBlank { "Untitled Presentation" }) }
    var selectedSlideIndex by remember { mutableIntStateOf(0) }
    var isPresenterMode by remember { mutableStateOf(false) }

    val slides = remember {
        mutableStateListOf(
            SlideData(1, "QubDocs Platform Strategy", "One productivity platform for Drive, Docs, Sheets & Forms"),
            SlideData(2, "Offline-First Engine", "Room Database + Local Asset WebView JS Bridge"),
            SlideData(3, "KingsChat SSO Auth", "Unified identity across all suites of apps")
        )
    }

    val slidesOrange = Color(0xFFEA580C)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    Button(
                        onClick = { isPresenterMode = !isPresenterMode },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = slidesOrange),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(if (isPresenterMode) "Exit" else "Present", fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = slidesOrange,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        },
        bottomBar = {
            if (!isPresenterMode) {
                // Slide Deck Strip
                Surface(
                    color = Color(0xFF0F172A),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding( vertical = 8.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Slides (${slides.size})", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            IconButton(onClick = {
                                slides.add(
                                    SlideData(
                                        id = slides.size + 1,
                                        slideTitle = "New Slide",
                                        slideSubtitle = "Tap to edit subtitle"
                                    )
                                )
                            }) {
                                Icon(Icons.Default.Add, contentDescription = "Add Slide", tint = slidesOrange)
                            }
                        }

                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            itemsIndexed(slides) { idx, slide ->
                                val isSelected = idx == selectedSlideIndex
                                Box(
                                    modifier = Modifier
                                        .size(width = 90.dp, height = 55.dp)
                                        .background(Color.White, shape = RoundedCornerShape(4.dp))
                                        .border(
                                            width = if (isSelected) 3.dp else 1.dp,
                                            color = if (isSelected) slidesOrange else Color.Gray,
                                            shape = RoundedCornerShape(4.dp)
                                        )
                                        .clickable { selectedSlideIndex = idx },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "${slide.id}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = slidesOrange
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        val currentSlide = slides.getOrNull(selectedSlideIndex) ?: slides[0]

        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(if (isPresenterMode) Color.Black else Color(0xFF1E293B)),
            contentAlignment = Alignment.Center
        ) {
            // Main Slide Canvas Card
            Card(
                modifier = Modifier
                    .aspectRatio(16f / 9f)
                    .fillMaxWidth(0.92f),
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = currentSlide.slideTitle,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A),
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = currentSlide.slideSubtitle,
                        fontSize = 15.sp,
                        color = Color(0xFF475569),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
