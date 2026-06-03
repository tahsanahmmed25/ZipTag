# ZipTag

<p align="center">
  <strong>ZipTag — A fast, polished, fully offline desktop archiver.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v0.1.0-teal" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platforms" />
</p>

---

ZipTag is an offline-first desktop archiving utility built to protect user privacy while delivering high performance. Unlike bloated modern utilities, ZipTag contains no telemetry, requires no user accounts, and executes all compression and extraction routines completely locally on the host machine. 

## Features

- **Multi-Format Creation**: Create archives in `zip`, `7z`, `tar.gz`, `tar.xz`, `tar.bz2`, and `tar.zst`.
- **Exhaustive Extraction**: Extract `zip`, `7z`, `tar.gz`, `tar.xz`, `tar.bz2`, `tar.zst`, `rar`, and `iso` archives.
- **Batch Processing Queue**: Queue multiple operations sequentially with real-time speed, progress, and compression ratio indicators.
- **Privacy & Security**: Built-in password-based encryption and decryption.
- **Sleek Aesthetic System**: Choose from four premium UI themes (Teal Clarity, Slate Mono, Indigo Focus, Amber Warmth) in both Light and Dark modes.
- **Context Menu Integration**: Optional integration to compress or extract directly from Windows Explorer, macOS Finder, or Linux file managers.
- **Automated Updates**: Safe, local update check using secure public GitHub APIs.

---

## Screenshots

### Compress View

<div align="center">

| Light Mode (Teal Clarity) | Dark Mode (Teal Clarity) |
|:---:|:---:|
| ![](Screenshots/compress-teal-clarity-light.png) | ![](Screenshots/compress-teal-clarity-dark.png) |

| Light Mode (Slate Mono) | Dark Mode (Slate Mono) |
|:---:|:---:|
| ![](Screenshots/compress-slate-mono-light.png) | ![](Screenshots/compress-slate-mono-dark.png) |

| Light Mode (Indigo Focus) | Dark Mode (Indigo Focus) |
|:---:|:---:|
| ![](Screenshots/compress-indigo-focus-light.png) | ![](Screenshots/compress-indigo-focus-dark.png) |

| Light Mode (Amber Warmth) | Dark Mode (Amber Warmth) |
|:---:|:---:|
| ![](Screenshots/compress-amber-warmth-light.png) | ![](Screenshots/compress-amber-warmth-dark.png) |

</div>

### Queue View

<div align="center">

| Light Mode (Teal Clarity) | Dark Mode (Teal Clarity) |
|:---:|:---:|
| ![](Screenshots/queue-teal-clarity-light.png) | ![](Screenshots/queue-teal-clarity-dark.png) |

| Light Mode (Slate Mono) | Dark Mode (Slate Mono) |
|:---:|:---:|
| ![](Screenshots/queue-slate-mono-light.png) | ![](Screenshots/queue-slate-mono-dark.png) |

| Light Mode (Indigo Focus) | Dark Mode (Indigo Focus) |
|:---:|:---:|
| ![](Screenshots/queue-indigo-focus-light.png) | ![](Screenshots/queue-indigo-focus-dark.png) |

| Light Mode (Amber Warmth) | Dark Mode (Amber Warmth) |
|:---:|:---:|
| ![](Screenshots/queue-amber-warmth-light.png) | ![](Screenshots/queue-amber-warmth-dark.png) |

</div>

### About View

<div align="center">

| Light Mode (Teal Clarity) | Dark Mode (Teal Clarity) |
|:---:|:---:|
| ![](Screenshots/about-teal-clarity-light.png) | ![](Screenshots/about-teal-clarity-dark.png) |

| Light Mode (Slate Mono) | Dark Mode (Slate Mono) |
|:---:|:---:|
| ![](Screenshots/about-slate-mono-light.png) | ![](Screenshots/about-slate-mono-dark.png) |

| Light Mode (Indigo Focus) | Dark Mode (Indigo Focus) |
|:---:|:---:|
| ![](Screenshots/about-indigo-focus-light.png) | ![](Screenshots/about-indigo-focus-dark.png) |

| Light Mode (Amber Warmth) | Dark Mode (Amber Warmth) |
|:---:|:---:|
| ![](Screenshots/about-amber-warmth-light.png) | ![](Screenshots/about-amber-warmth-dark.png) |

</div>

---

## Downloads

Download the latest installer or executable for your platform from the [GitHub Releases](https://github.com/tahsanahmmed25/ZipTag/releases) page:

- **Windows**: `ZipTag_0.1.0_x64-setup.exe` (NSIS Installer) or `.msi`
- **macOS**: `ZipTag_0.1.0_x64.dmg`
- **Linux**: `ziptag_0.1.0_amd64.deb` / `ziptag_0.1.0_amd64.AppImage`

---

## Build from Source

### Prerequisites

1. **Rust**: Make sure the Rust toolchain (cargo, rustc) is installed. [Install Rust](https://www.rust-lang.org/tools/install).
2. **Node.js**: Version 18 or later is recommended.
3. **Tauri CLI**: Installed globally or run via npm.

### Instructions

1. Clone the repository and install npm packages:
   ```bash
   git clone https://github.com/tahsanahmmed25/ZipTag.git
   cd ZipTag
   npm install
   ```

2. Run the application in development mode:
   ```bash
   npm run tauri dev
   ```

3. Build production installers for the host platform:
   ```bash
   npm run tauri build
   ```

---

## License

ZipTag is distributed under the terms of the MIT License. See [LICENSE](LICENSE) for details.
