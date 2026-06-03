# ZipTag Design Specifications

This document serves as the absolute source of truth for the ZipTag application design system, user interface structure, styling tokens, layout behavior, and component specifications.

---

## 1. Design Philosophy
ZipTag is crafted as a desktop utility with three core pillars:
*   **Compact Utility**: Interfaces are designed to fit clean, structured controls into a single non-resizable or compact-resizable view without wasted space. Layout components are dense but highly readable, emphasizing clarity over decoration.
*   **Offline-First & Local Preservation**: All operations (compression, extraction, queue status) run completely locally on the host machine.
*   **Zero Telemetry & Analytics**: The application collects no user behavior, logs, or metrics. Updates are fetched directly via public GitHub APIs without sending any payload, identifying details, or analytics back.

---

## 2. Window Dimensions
The Tauri configuration defines the application window boundary properties to maintain structural density:
*   **Default Size**: `860px` width × `560px` height.
*   **Minimum Size**: `720px` width × `480px` height.
*   **Maximum Size**: No upper bounds set by configuration, but the layout is optimized to look structured and anchored within standard desktop display limits.
*   **Window Decorations**: `decorations: false`. A custom frameless window titlebar is rendered via React to match active themes.

---

## 3. Typography & Font Stack
The application loads the primary font system using Google Fonts with fallbacks for standard system UI fonts:
*   **Font Stack**: `"Inter"`, `"Segoe UI Variable"`, `"Segoe UI"`, `system-ui`, `sans-serif`
*   **Type Scale & Roles**:
    *   **Main Title / Window Header**: `20px` size, weight `600`, line-height `28px`.
    *   **Page Main Header**: `19px` size, weight `600`.
    *   **Section Headers / Labels**: `13px` size, weight `500` or `600`.
    *   **Body Text (Standard)**: `12px` size, weight `400` or `500`, line-height `18px`.
    *   **Secondary Body / Muted details**: `11px` or `11.5px` size, weight `400`.
    *   **Navigation Sidebar Items**: `12px` size, weight `500` or `600`.
    *   **Badges / Pills**: `10px` or `10.5px` size, weight `600` (uppercase or high contrast).

---

## 4. CSS Color Token System
The layout is styled entirely using CSS variables. The core variables and their purposes include:

| CSS Variable | Purpose / Usage |
| :--- | :--- |
| `--bg-window` | The primary background color of the main application window frame. |
| `--bg-surface` | Secondary background used to isolate view containers from the outer window frame. |
| `--bg-input` | Background color for form fields, select options, and dropdown containers. |
| `--bg-card` | Panel/container background where core forms and drop zones are hosted. |
| `--bg-hover` | Background color applied during button, list-item, or dropdown option hovers. |
| `--bg-active` | Background tint for selected sidebar elements, active pills, or highlighted options. |
| `--border` | Structural border color dividing sidebar, panels, or table boundaries. |
| `--border-focus` | Border color indicating focused inputs or active control states. |
| `--text-primary` | High-contrast text color for titles, labels, input values, and main text elements. |
| `--text-secondary` | Medium-contrast text color for sub-labels, helpers, and inactive nav labels. |
| `--text-tertiary` | Muted text color for placeholders, inactive values, and tertiary details. |
| `--text-on-accent` | Text color rendered on top of solid accent-colored backgrounds (always `#ffffff`). |
| `--accent` | Brand theme color applied to active buttons, progress fill, active indicators, and checkmarks. |
| `--accent-hover` | Darker/lighter variant of the accent color for active button hover states. |
| `--progress-fill` | Color mapping for the progress bar fill (typically links to `--accent`). |
| `--progress-track`| Background track color for progress bars (typically links to `--bg-hover`). |
| `--scrollbar` | Scrollbar thumb color mapping. |
| `--sidebar-bg` | Background color isolating the sidebar navigation panel. |
| `--titlebar-control-hover` | Hover color state for custom close, maximize, and minimize buttons. |

---

## 5. Themes Configuration (Detailed Matrix)
ZipTag supports 4 visual themes with light and dark mode mappings:

### 1. Slate Mono (Default Theme)
*   **Light Mode**:
    *   `--accent`: `#111827` (Near-black, high contrast)
    *   `--accent-hover`: `#000000`
    *   `--border-focus`: `#6b7280`
    *   `--bg-active`: `#e5e7eb` (Clear gray active tint)
*   **Dark Mode**:
    *   `--accent`: `#f3f4f6` (Near-white)
    *   `--accent-hover`: `#ffffff`
    *   `--border-focus`: `#9ca3af`
    *   `--bg-active`: `#27272a` (Lighter gray)

### 2. Teal Clarity
*   **Light Mode**:
    *   `--accent`: `#0d9488`
    *   `--accent-hover`: `#0f766e`
    *   `--border-focus`: `#5eead4`
    *   `--bg-active`: `#f0fdfa`
*   **Dark Mode**:
    *   `--accent`: `#2dd4bf`
    *   `--accent-hover`: `#14b8a6`
    *   `--border-focus`: `#0d9488`
    *   `--bg-active`: `#0a1f1e`

### 3. Indigo Focus
*   **Light Mode**:
    *   `--accent`: `#4f46e5`
    *   `--accent-hover`: `#4338ca`
    *   `--border-focus`: `#a5b4fc`
    *   `--bg-active`: `#eef2ff`
*   **Dark Mode**:
    *   `--accent`: `#818cf8`
    *   `--accent-hover`: `#6366f1`
    *   `--border-focus`: `#4f46e5`
    *   `--bg-active`: `#1e1b4b`

### 4. Amber Warmth
*   **Light Mode**:
    *   `--accent`: `#d97706`
    *   `--accent-hover`: `#b45309`
    *   `--border-focus`: `#fcd34d`
    *   `--bg-active`: `#fefce8`
*   **Dark Mode**:
    *   `--accent`: `#f59e0b`
    *   `--accent-hover`: `#d97706`
    *   `--border-focus`: `#d97706`
    *   `--bg-active`: `#1f1a08`

### Theme State Logic
*   **LocalStorage Keys**:
    *   `ziptag_theme`: Holds active Theme ID (`"slate-mono"`, `"teal-clarity"`, `"indigo-focus"`, or `"amber-warmth"`).
    *   `ziptag_dark`: Holds dark mode boolean flag (`"true"` or `"false"`).
*   **DOM Integration**:
    *   Active theme class or attribute is set via: `document.documentElement.setAttribute("data-theme", theme);`
    *   Dark mode toggle toggles `.dark` class: `document.documentElement.classList.toggle("dark", darkMode);`

---

## 6. Sidebar Layout & Anatomy
*   **Sidebar Width**: Fixed `220px` width.
*   **Structure**:
    *   **Brand Area**: Top portion displaying the product logo, product name `ZipTag`, and current version.
    *   **Navigation Groups**: Grouped using labels:
        *   `MAIN OPERATIONS`: Includes "Compress" and "Extract" options.
        *   `SYSTEM & STATUS`: Includes "Queue", "Themes", and "About" options.
    *   **Nav Item Active Indicator**: Left-border colored with the theme accent (`border-l-2 border-[var(--accent)]`), background set to `--bg-active`, and text color highlighted.
    *   **Nav Item Hover**: Transitions background to `--bg-hover` with scale transitions.
    *   **Footer Controls**: Bottom area displays active state indicators or quick status indicators. Dark mode toggle is placed inside the Themes configuration page itself.

---

## 7. Pages Layout & Interactive Spec
*   **Compress View**:
    *   Dual-option buttons for "Add files" or "Add folder".
    *   Large dashed drop zone area supporting OS file drag-and-drop.
    *   Format pill selector for selecting archive format.
    *   Compression level slider (`fast`, `balanced`, `maximum`).
    *   Output path input with file picker button.
    *   Optional password protection fields with input visibility toggle.
*   **Extract View**:
    *   Single button for "Open archive" to pick a file.
    *   Dashed drop zone supporting single archive drag-and-drop.
    *   Destination folder path input with directory picker button.
    *   Optional extraction password field.
*   **Queue View**:
    *   Lists active, completed, failed, and running jobs.
    *   "Clear Completed" button.
    *   Progress bars showing numeric progress, speeds, and current file name messages.
    *   Report panels displaying compression ratio, original size, saved space percent, and operation duration.
*   **Themes View**:
    *   Displays 4 cards representing visual themes.
    *   Clicking selects theme instantly.
    *   Muted label text below showing theme characteristics.
    *   Large dark mode toggle switch.
*   **About View**:
    *   ZipTag product details.
    *   License details, offline-first design statement, and legal notice of zero tracking.

---

## 8. Spacing & Components System
*   **Padding**:
    *   Component standard container padding: `16px`.
    *   Form group vertical spacing: `12px` or `14px`.
    *   Inner button padding: `8px` vertical, `14px` horizontal.
*   **Gap Values**:
    *   Sidebar grid item gap: `6px`.
    *   Main view grid component gap: `16px`.
*   **Border-Radius Rules**:
    *   Inputs & Selector fields: `7px`.
    *   Cards / Panels / Form containers: `10px`.
    *   Modal windows / Outer popups: `12px`.
*   **Pills & Format Selectors**:
    *   Pills wrap automatically if they exceed row limits.
    *   Active pill maps to `--accent` background with `--text-on-accent` text.

---

## 9. Icon Library
*   **Lucide Icons Only**: Only icons from the `lucide-react` library are used.
*   **Icon Palette Mappings**: Icons use structural classes linking to color variables, e.g., `stroke-[var(--text-secondary)]` or `stroke-[var(--accent)]`.

---

## 10. Design Restrictions ("What Never to Do")
*   **No Hardcoded Colors**: Colors must always reference the CSS variables.
*   **No Emojis**: Emojis are strictly banned from UI elements to maintain a professional tool aesthetic.
*   **No Mixed Icon Sets**: Icons from other libraries (e.g., FontAwesome, Heroicons) must not be introduced.
*   **No Telemetry**: No tracking tools, Google Analytics, Mixpanel, or custom HTTP log hooks.
*   **No Accounts**: The software has no signup, sign-in, cloud syncing, or profile systems.
