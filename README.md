<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="ZipTag Logo" width="128" height="128" />

  # ZipTag

  <p align="center">
    <strong>A fast, polished, fully offline desktop archiver built with Tauri & React.</strong>
  </p>

  <p align="center">
    <a href="https://github.com/tahsanahmmed25/ZipTag/releases/latest">
      <img src="https://img.shields.io/github/v/release/tahsanahmmed25/ZipTag?color=0f766e&label=version" alt="Latest Version" />
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/github/license/tahsanahmmed25/ZipTag?color=2563eb" alt="License" />
    </a>
    <img src="https://img.shields.io/badge/offline-100%25-success?color=16a34a" alt="100% Offline" />
    <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-gray" alt="Platforms" />
  </p>
</div>

---

ZipTag is an offline-first desktop archiving utility built to protect user privacy while delivering high performance. Unlike bloated modern utilities, ZipTag contains no telemetry, requires no user accounts, and executes all compression and extraction routines completely locally on the host machine.

> 🔒 **Privacy First**: ZipTag is completely offline-first. No telemetry, no cloud accounts, no tracking. All compression/extraction happens strictly on your local machine.

---

## Key Features

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <h3>📦 Multi-Format Creation</h3>
      Create high-ratio archives instantly:
      <ul>
        <li><code>zip</code>, <code>7z</code></li>
        <li><code>tar.gz</code>, <code>tar.xz</code></li>
        <li><code>tar.bz2</code>, <code>tar.zst</code></li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🔓 Universal Extraction</h3>
      Extract almost any format:
      <ul>
        <li><code>zip</code>, <code>7z</code>, <code>rar</code>, <code>iso</code></li>
        <li><code>tar.gz</code>, <code>tar.xz</code></li>
        <li><code>tar.bz2</code>, <code>tar.zst</code></li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>⚡ Batch Processing Queue</h3>
      Process multiple archiving operations sequentially. Includes real-time indicators for speed, completion progress, and compression ratio.
    </td>
    <td width="50%" valign="top">
      <h3>🎨 Custom Themes & Dark Mode</h3>
      Dynamic aesthetic engine. Choose from 4 premium themes (Teal Clarity, Slate Mono, Indigo Focus, Amber Warmth) in both light & dark modes.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🛡️ Encryption</h3>
      Built-in secure password-based encryption and decryption.
    </td>
    <td width="50%" valign="top">
      <h3>💻 Context Menu Integration</h3>
      Quick actions right from your operating system's native file managers (Explorer, Finder, Nautilus, Dolphin).
    </td>
  </tr>
</table>

---

## Downloads

Get the installer or executable for your platform from the [GitHub Releases](https://github.com/tahsanahmmed25/ZipTag/releases/latest) page:

<div align="center">

| Platform | Installer Type | Download Link |
| :--- | :--- | :--- |
| **Windows** | NSIS Installer (`.exe`) | [Download Setup](https://github.com/tahsanahmmed25/ZipTag/releases/latest) |
| | MSI Installer (`.msi`) | [Download MSI](https://github.com/tahsanahmmed25/ZipTag/releases/latest) |
| **macOS** | Disk Image (`.dmg`) | [Download DMG](https://github.com/tahsanahmmed25/ZipTag/releases/latest) |
| | App Bundle (`.tar.gz`) | [Download Tarball](https://github.com/tahsanahmmed25/ZipTag/releases/latest) |
| **Linux** | Debian package (`.deb`) | [Download DEB](https://github.com/tahsanahmmed25/ZipTag/releases/latest) |
| | RedHat package (`.rpm`) | [Download RPM](https://github.com/tahsanahmmed25/ZipTag/releases/latest) |
| | AppImage (`.AppImage`) | [Download AppImage](https://github.com/tahsanahmmed25/ZipTag/releases/latest) |

</div>

---

## Build from Source

### Prerequisites

1. **Rust**: Make sure the Rust toolchain (`cargo`, `rustc`) is installed. [Install Rust](https://www.rust-lang.org/tools/install).
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
