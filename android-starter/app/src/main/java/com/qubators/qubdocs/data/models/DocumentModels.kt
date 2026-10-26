package com.qubators.qubdocs.data.models

import kotlinx.serialization.Serializable

@Serializable
enum class NativeFileType {
    DOCUMENT,
    SPREADSHEET,
    FORM,
    PDF,
    SLIDES,
    OTHER
}

@Serializable
data class FileItemDto(
    val id: String,
    val name: String,
    val fileType: NativeFileType,
    val mimeType: String,
    val sizeBytes: Long = 0,
    val folderId: String? = null,
    val updatedAt: String,
    val createdAt: String,
    val isStarred: Boolean = false,
    val isTrashed: Boolean = false
)

@Serializable
data class DriveResponseDto(
    val items: List<FileItemDto>,
    val nextCursor: String? = null
)

@Serializable
data class CreateDocumentRequestDto(
    val title: String,
    val folderId: String? = null,
    val fileType: String = "DOCUMENT",
    val contentJson: String? = null
)

@Serializable
data class UpdateDocumentRequestDto(
    val title: String? = null,
    val contentJson: String? = null
)

@Serializable
data class LoginRequestDto(
    val email: String,
    val password: String
)

@Serializable
data class RegisterRequestDto(
    val email: String,
    val password: String,
    val name: String
)

@Serializable
data class KingsChatAuthRequestDto(
    val accessToken: String? = null,
    val authCode: String? = null,
    val phoneNumber: String? = null
)

@Serializable
data class AuthResponseDto(
    val token: String,
    val user: UserDto
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val name: String,
    val avatarUrl: String? = null,
    val authProvider: String = "email"
)

@Serializable
data class FormattingState(
    val isBold: Boolean = false,
    val isItalic: Boolean = false,
    val isStrike: Boolean = false,
    val isHeading1: Boolean = false,
    val isHeading2: Boolean = false,
    val isHeading3: Boolean = false,
    val isBulletList: Boolean = false,
    val isOrderedList: Boolean = false,
    val isTaskList: Boolean = false,
    val isBlockquote: Boolean = false,
    val isCodeBlock: Boolean = false,
    val canUndo: Boolean = false,
    val canRedo: Boolean = false
)
