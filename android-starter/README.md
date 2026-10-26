# Qub Suite — Android Native App Starter Kit

This starter kit provides a production-grade, offline-first Android application designed to integrate with the Qub Suite backend (`@qub/api`) and the embedded mobile editor engine.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 NATIVE JETPACK COMPOSE                      │
│                                                             │
│  • Native Navigation, Tabs & Drawer                         │
│  • Qub Drive & File Browser (LazyColumn, pull-to-refresh)   │
│  • Offline Database (Room / SQLite)                         │
│  • Background Sync & Upload Queue (WorkManager)             │
│  • Android Keystore & Biometrics (Fingerprint/Face Unlock)  │
│  • Storage Access Framework (Open/Import external files)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Bidirectional JS Bridge
┌──────────────────────────────▼──────────────────────────────┐
│        LOCAL-ASSET WEBVIEW (0ms Network / 100% Offline)     │
│                                                             │
│  • Loaded from: assets/qub-editor/mobile-editor.html        │
│  • TipTap / ProseMirror Engine (Qub Docs)                   │
│  • Native Keyboard accessory bar passed from Compose        │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

- `app/src/main/java/com/qub/suite/`
  - `data/models/`
    - `DocumentModels.kt` — Data models mapping 1:1 with `@qub/shared` DTOs (`FileItemDto`, `DriveResponseDto`, `FormattingState`).
  - `data/local/`
    - `QubDatabase.kt` — Room database, `DocumentEntity`, `SyncQueueEntity`, `DocumentDao`, and `SyncQueueDao` for local-first storage.
  - `data/network/`
    - `QubApiService.kt` — Retrofit client and `AuthInterceptor` configured for Fastify REST endpoints.
  - `data/sync/`
    - `QubSyncWorker.kt` — WorkManager coroutine worker that synchronizes offline drafts and queued mutations when connectivity resumes.
  - `editor/`
    - `QubEditorBridge.kt` — Android `@JavascriptInterface` handling bidirectional event exchange (`onEditorReady`, `onContentChanged`, `onFormattingStateChanged`, `onTitleDetected`).
  - `ui/`
    - `QubEditorScreen.kt` — Full Jetpack Compose screen embedding the `WebView` via `WebViewAssetLoader` with a native Material 3 bottom formatting toolbar that lifts above the soft keyboard.

---

## How to Build the Mobile Editor Bundle

Inside the monorepo root:
```bash
# Compiles the lightweight standalone editor bundle (< 500 KB) into apps/web/dist-mobile/
pnpm --filter @qub/web build:mobile
```

Copy the output into the Android app's asset directory:
```bash
# Windows PowerShell
New-Item -ItemType Directory -Force -Path "android-starter/app/src/main/assets/qub-editor"
Copy-Item -Recurse -Force "apps/web/dist-mobile/*" "android-starter/app/src/main/assets/qub-editor/"
```

---

## Running in Android Studio

1. Open Android Studio and select **Open** -> Navigate to `android-starter`.
2. Configure your API base URL in `QubApiService.kt` or `local.properties`:
   - For Android Emulator: `http://10.0.2.2:4100` (maps to your host machine's `localhost:4100`).
   - For a physical device on the same Wi-Fi: `http://<your-ip>:4100`.
   - For production: `https://docs.qubdocs.online`.
3. Press **Run** (Shift + F10) to deploy to an emulator or physical device.
