# ZipTag Technical Architecture Overview

This document provides a comprehensive blueprint of the ZipTag codebase, detailing the technology stack, directory structure, IPC mechanism, Rust backend routines, frontend state management, and build pipeline.

---

## 1. Core Technology Stack
ZipTag is constructed using a high-performance, modern desktop framework:
*   **System Wrapper**: [Tauri v2](https://tauri.app/) (Rust backend core providing native system hooks, file access, and multi-threaded worker pools).
*   **Backend Language**: Rust (strong safety guarantees, low memory footprint).
*   **Frontend UI Library**: React (TypeScript) + Vite bundler.
*   **Styling**: Vanilla CSS alongside Tailwind CSS configurations.
*   **Component Architecture**: Clean modular elements styled with global variable tokens.
*   **Icons**: [Lucide React](https://lucide.dev/) (pure SVG icons).
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand) (lightweight client-side state store).

---

## 2. Directory Layout & Structure

```
ZipTag/
├── src/                          # Frontend React + TypeScript application
│   ├── components/               # React views & component layers
│   │   └── ui/                   # Modular UI primitive wrappers (badges, cards, buttons)
│   ├── lib/                      # Helper libraries, utilities, and integrations
│   │   ├── archive.ts            # Type definitions, path utilities, and format lists
│   │   ├── updater.ts            # Silent app updater trigger hook
│   │   └── utils.ts              # Styling mixers (cn) & data unit formatters
│   ├── store/                    # Zustand stores managing application state
│   │   └── jobs.ts               # Job queue store (jobs array, progress updates, success states)
│   ├── App.tsx                   # Main React entry component, router, and drag-drop handlers
│   ├── main.tsx                  # React DOM render bootstrap
│   └── styles.css                # Global CSS system, themes, and layout rulesets
├── src-tauri/                    # Backend Tauri Rust application
│   ├── Cargo.toml                # Rust crate dependencies & package metadata
│   ├── tauri.conf.json           # Tauri framework build, window, and plugin configuration
│   └── src/                      # Rust backend source
│       ├── main.rs               # Executable binary entry-point
│       └── lib.rs                # Library module containing commands, workers, and formats
├── docs/                         # Codebase specifications and guides
│   ├── design.md                 # UI/UX, typography, and styling documentation
│   └── architecture-overview.md  # System structure and API documentation (this file)
└── dist/                         # Compiled frontend distribution bundle (Vite output)
```

---

## 3. Frontend-Backend Communication (IPC)
ZipTag utilizes Tauri's secure Inter-Process Communication (IPC) layer to bridge React with Rust.

### Invoke Calls (Frontend to Backend)
For long-running, blocking operations (compression & extraction), the frontend calls `invoke()` from `@tauri-apps/api/core`. Since Tauri commands run on the main process thread, ZipTag spawns a worker thread pool (`tauri::async_runtime::spawn_blocking`) in the command handler. This ensures that the main process and UI thread remain fully responsive.

### Event Streaming (Backend to Frontend)
As a job processes, the Rust backend streams real-time status and progress updates back to the webview.
*   **Event Name**: `ziptag-job-progress`
*   **Payload Schema**:
    ```typescript
    export type BackendProgress = {
      jobId: string;
      status: "queued" | "running" | "done" | "failed" | "cancelled";
      progress: number;
      message: string;
    };
    ```
*   **Listener**: App.tsx initializes a listener on startup:
    ```typescript
    listen<BackendProgress>("ziptag-job-progress", ({ payload }) => {
      applyProgress(payload);
    });
    ```

---

## 4. Tauri Commands Specifications

### 1. `compress_archive`
*   **Type**: `tauri::command` (Asynchronous/Non-blocking via `spawn_blocking`)
*   **Arguments**:
    *   `request`: `CompressRequest` containing `jobId`, `inputPaths`, `outputPath`, `format`, `level`, and optional `password`.
*   **Return Type**: `Result<JobReport, String>`
*   **Action**: Recursively lists and maps files to include, calculates total source size, opens a target writer matching the format (e.g., zip, 7z, tar builder), feeds streams through `ProgressReader` to monitor cancellation, and returns details upon completion.

### 2. `extract_archive`
*   **Type**: `tauri::command` (Asynchronous/Non-blocking via `spawn_blocking`)
*   **Arguments**:
    *   `request`: `ExtractRequest` containing `jobId`, `archivePath`, `destinationPath`, and optional `password`.
*   **Return Type**: `Result<JobReport, String>`
*   **Action**: Resolves the archive format, initializes readers with password validation, iterates over entries, creates parent directories, writes decompressed contents to disk, checks for job cancellation, and returns extraction details.

### 3. `cancel_job`
*   **Type**: `tauri::command` (Synchronous/Instant response)
*   **Arguments**:
    *   `jobId`: `String`
*   **Return Type**: `()`
*   **Action**: Locks `ArchiveState` and inserts the target job ID into the `cancelled_jobs` set. Active background workers check this state at the next read iteration to abort cleanly.

---

## 5. Crate Dependencies & Purpose

*   `zip`: Handles generation and decompression of `.zip` files (supports Deflate compression).
*   `sevenz-rust2`: Core crate for reading and writing `.7z` archives using LZMA2 compression. Built with `aes256` capabilities for encryption.
*   `tar` + `flate2`/`xz2`/`bzip2`/`zstd`: Handles tape archive (TAR) wrapping with specific compression encoders:
    *   `flate2` for `.tar.gz` (GZIP).
    *   `xz2` for `.tar.xz` (XZ).
    *   `bzip2` for `.tar.bz2` (Bzip2).
    *   `zstd` for `.tar.zst` (Zstandard).
*   `tauri-plugin-updater`: Integrates auto-updating capabilities natively.
*   `walkdir`: Multi-platform recursive directory traversal.
*   `serde`/`serde_json`: High-speed serialization of progress events and job payloads.

---

## 6. Supported Archive Mappings

*   **Creation & Extraction Supported**:
    *   `zip` (Standard Zip archive)
    *   `7z` (LZMA2 High-Ratio archive)
    *   `tar.gz` (POSIX Tar with GZIP compression)
    *   `tar.xz` (POSIX Tar with XZ compression)
    *   `tar.bz2` (POSIX Tar with Bzip2 compression)
    *   `tar.zst` (POSIX Tar with Zstandard compression)
*   **Extraction-Only Supported**:
    *   `rar` (Extract-only due to proprietary licensing restriction of the RAR compression algorithm).
    *   `iso` (Extract-only due to its purpose as a read-only disk image standard).

---

## 7. State Management (Zustand)
Frontend application state is managed under `src/store/jobs.ts` with `useJobStore`:
*   `jobs`: Mapped array of all jobs (`ZipTagJob`).
*   `addJob(job)`: Appends a newly initiated job configuration to the queue.
*   `applyProgress(progress)`: Updates active progress percentages and messages.
*   `completeJob(jobId, report)`: Marks a job as completed and stores the performance metadata.
*   `failJob(jobId, error)`: Marks a job as failed and sets the error message.
*   `clearCompleted()`: Filters the queue array to retain only active, queued, or running jobs.

---

## 8. Queue System & Worker Cancellation
*   **Queue Flow**: The user kicks off an operation. The frontend registers the job state as `"queued"`, transitions the UI view to the Queue page, and instantly invokes the backend command asynchronously.
*   **Worker Execution**: The backend command handler transitions the job to `"running"` and processes the payload.
*   **Cancellation**: When the cancel button is clicked, `cancel_job` is invoked. The backend worker catches this via `is_cancelled` during loop iterations or block-read ticks. If cancelled, the worker drops the active file writer, deletes the incomplete target file from disk, and returns a `"Job cancelled"` error to the frontend.

---

## 9. Silent Updater Integration
*   The application updater is powered by the `tauri-plugin-updater` plugin.
*   **Check on Launch**: `App.tsx` calls `runSilentUpdateCheck` on boot.
*   **GitHub releases endpoint**: Tauri queries the public JSON manifest hosted at GitHub Releases.
*   **Silent Mode**: Set to `passive` on Windows inside `tauri.conf.json` to perform updates quietly without interrupting the user.

---

## 10. OS Integration & Context Menus
File associations are configured within `tauri.conf.json` for `.zip`, `.7z`, `.rar`, `.iso`, `.tar`, and compressed tar extensions.
*   **Windows**: Registry associations are generated automatically by the NSIS installer.
*   **macOS**: Plist keys map file associations to Finder.
*   **Linux**: `.desktop` entries register standard MIME types.

---

## 11. Packaging & Output Locations
*   **Dev Compilation**: Run `npm run tauri dev`.
*   **Release Compilation**: Run `npm run build` followed by `npx tauri build`.
*   **Output Binaries**: Compiled release files are generated under `src-tauri/target/release/`. Complete installer packages (.msi, .deb, .dmg, .AppImage) are outputted to `src-tauri/target/release/bundle/`.
