import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArchiveRestore,
  CheckCircle2,
  Circle,
  Download,
  Folder,
  GitBranch,
  Info,
  Layers,
  LockKeyhole,
  Maximize2,
  Minus,
  PackageCheck,
  Palette,
  Play,
  Plus,
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import {
  type ArchiveJobReport,
  type BackendProgress,
  type CompressionLevel,
  type CreateFormat,
  createFormats,
  defaultArchivePath,
  defaultExtractPath,
  fileNameFromPath,
  isArchivePath,
  newJobId,
} from "@/lib/archive";
import { runSilentUpdateCheck } from "@/lib/updater";
import { cn, formatBytes, formatDuration } from "@/lib/utils";
import { useJobStore, type ZipTagJob } from "@/store/jobs";
if (typeof window !== "undefined") {
  (window as any).useJobStore = useJobStore;
}


function FileArchive({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
      <line x1="12" y1="12" x2="12" y2="19" />
      <line x1="9.5" y1="13" x2="12" y2="13" />
      <line x1="12" y1="14.5" x2="14.5" y2="14.5" />
      <line x1="9.5" y1="16" x2="12" y2="16" />
      <line x1="12" y1="17.5" x2="14.5" y2="17.5" />
    </svg>
  );
}

type ActiveView = "compress" | "extract" | "queue" | "about" | "themes";
type ThemeId = "teal-clarity" | "slate-mono" | "indigo-focus" | "amber-warmth";

function App() {
  const [view, setView] = useState<ActiveView>("compress");
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("ziptag_dark") === "true");
  const [theme, setTheme] = useState<ThemeId>(() => (localStorage.getItem("ziptag_theme") as ThemeId) || "slate-mono");
  const [compressPaths, setCompressPaths] = useState<string[]>([]);
  const [extractPath, setExtractPath] = useState("");
  const [format, setFormat] = useState<CreateFormat>("zip");
  const [level, setLevel] = useState<CompressionLevel>("balanced");
  const [outputPath, setOutputPath] = useState("");
  const [destinationPath, setDestinationPath] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [compressPassword, setCompressPassword] = useState("");
  const [extractPassword, setExtractPassword] = useState("");
  // "compress" | "extract" | null — set when launched from OS context menu
  const [quickMode, setQuickMode] = useState<{ mode: string; paths: string[] } | null>(null);
  const { jobs, addJob, applyProgress, completeJob, failJob, clearCompleted } = useJobStore();

  const recentReport = useMemo(() => [...jobs].reverse().find((job) => job.report)?.report, [jobs]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("ziptag_dark", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ziptag_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (isTauriRuntime()) {
      void runSilentUpdateCheck(setUpdateMessage);
      void getCurrentWindow().show();
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    void listen<BackendProgress>("ziptag-job-progress", ({ payload }) => {
      applyProgress(payload);
    });

    void getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setDropActive(true);
        return;
      }

      if (event.payload.type === "leave") {
        setDropActive(false);
        return;
      }

      setDropActive(false);
      const paths = event.payload.paths;
      if (!paths.length) return;

      if (paths.length === 1 && isArchivePath(paths[0])) {
        setExtractPath(paths[0]);
        setDestinationPath(defaultExtractPath(paths[0]));
        setView("extract");
        return;
      }

      setCompressPaths(paths);
      setOutputPath(defaultArchivePath(paths, format));
      setView("compress");
    });
  }, [applyProgress, format]);

  useEffect(() => {
    if (compressPaths.length) {
      setOutputPath(defaultArchivePath(compressPaths, format));
    }
  }, [compressPaths, format]);

  // Detect context-menu launch mode (--quick-compress / --quick-extract)
  useEffect(() => {
    if (!isTauriRuntime()) return;
    void invoke<{ mode: string; paths: string[] }>("get_launch_mode").then((result) => {
      if (result.mode === "compress" || result.mode === "extract") {
        setQuickMode(result);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function pickCompressFiles() {
    if (!isTauriRuntime()) return;

    const selection = await open({ multiple: true, directory: false, title: "Add files" });
    const paths = Array.isArray(selection) ? selection : selection ? [selection] : [];
    if (paths.length) {
      setCompressPaths(paths);
      setOutputPath(defaultArchivePath(paths, format));
    }
  }

  async function pickCompressFolder() {
    if (!isTauriRuntime()) return;

    const selection = await open({ directory: true, multiple: false, title: "Add folder" });
    if (typeof selection === "string") {
      setCompressPaths([selection]);
      setOutputPath(defaultArchivePath([selection], format));
    }
  }

  async function pickArchive() {
    if (!isTauriRuntime()) return;

    const selection = await open({
      multiple: false,
      directory: false,
      title: "Open archive",
      filters: [{ name: "Archives", extensions: ["zip", "7z", "gz", "xz", "bz2", "zst", "rar", "iso"] }],
    });

    if (typeof selection === "string") {
      setExtractPath(selection);
      setDestinationPath(defaultExtractPath(selection));
    }
  }

  async function pickOutputPath() {
    if (!isTauriRuntime()) return;

    const selected = await save({
      title: "Save archive",
      defaultPath: outputPath || defaultArchivePath(compressPaths, format),
      filters: [{ name: format.toUpperCase(), extensions: [format.split(".").pop() ?? format] }],
    });

    if (selected) setOutputPath(selected);
  }

  async function pickDestination() {
    if (!isTauriRuntime()) return;

    const selected = await open({ directory: true, multiple: false, title: "Choose destination" });
    if (typeof selected === "string") setDestinationPath(selected);
  }

  async function runCompress() {
    if (!isTauriRuntime() || !compressPaths.length || !outputPath) return;

    const jobId = newJobId();
    const job: ZipTagJob = {
      id: jobId,
      kind: "compress",
      title: `${format.toUpperCase()} archive`,
      paths: compressPaths,
      outputPath,
      format,
      level,
      status: "queued",
      progress: 0,
      message: "Queued",
    };

    addJob(job);
    setView("queue");
    setCompressPaths([]);
    setOutputPath("");
    setCompressPassword("");

    try {
      const report = await invoke<ArchiveJobReport>("compress_archive", {
        request: { jobId, inputPaths: compressPaths, outputPath, format, level, password: compressPassword || undefined },
      });
      completeJob(jobId, report);
    } catch (error) {
      failJob(jobId, String(error));
    }
  }

  async function runExtract() {
    if (!isTauriRuntime() || !extractPath || !destinationPath) return;

    const jobId = newJobId();
    const job: ZipTagJob = {
      id: jobId,
      kind: "extract",
      title: fileNameFromPath(extractPath),
      paths: [extractPath],
      outputPath: destinationPath,
      status: "queued",
      progress: 0,
      message: "Queued",
    };

    addJob(job);
    setView("queue");

    try {
      const report = await invoke<ArchiveJobReport>("extract_archive", {
        request: { jobId, archivePath: extractPath, destinationPath, password: extractPassword || undefined },
      });
      completeJob(jobId, report);
    } catch (error) {
      failJob(jobId, String(error));
    }
  }

  // ── Quick-mode renders (context menu launches) ──────────────────────────
  if (quickMode?.mode === "compress") {
    return <QuickCompressDialog initialPaths={quickMode.paths} />;
  }
  if (quickMode?.mode === "extract") {
    return <QuickExtractDialog initialArchivePath={quickMode.paths[0] ?? ""} />;
  }

  return (
    <main className="app-window">
      <Titlebar />
      <div className="app-body">
        <Sidebar view={view} jobsCount={jobs.length} onViewChange={setView} />
        <section className="main-content">
          {updateMessage ? <div className="update-banner">{updateMessage}</div> : null}

          {view === "compress" ? (
            <CompressView
              dropActive={dropActive}
              paths={compressPaths}
              outputPath={outputPath}
              format={format}
              level={level}
              password={compressPassword}
              onFormatChange={setFormat}
              onLevelChange={setLevel}
              onPasswordChange={setCompressPassword}
              onPickFiles={pickCompressFiles}
              onPickFolder={pickCompressFolder}
              onPickOutput={pickOutputPath}
              onRun={runCompress}
            />
          ) : null}

          {view === "extract" ? (
            <ExtractView
              dropActive={dropActive}
              archivePath={extractPath}
              destinationPath={destinationPath}
              password={extractPassword}
              onPasswordChange={setExtractPassword}
              onPickArchive={pickArchive}
              onPickDestination={pickDestination}
              onRun={runExtract}
            />
          ) : null}

          {view === "queue" ? <QueueView jobs={jobs} recentReport={recentReport} onClearCompleted={clearCompleted} /> : null}
          {view === "about" ? <AboutView /> : null}
          {view === "themes" ? <ThemesView darkMode={darkMode} theme={theme} onDarkModeChange={setDarkMode} onThemeChange={setTheme} /> : null}
        </section>
      </div>
    </main>
  );
}

function Titlebar() {
  const currentWindow = isTauriRuntime() ? getCurrentWindow() : null;

  return (
    <div className="titlebar">
      <div className="titlebar-drag-region" data-tauri-drag-region />
      <div className="titlebar-controls" onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Minimize"
          onClick={(event) => {
            event.stopPropagation();
            void currentWindow?.minimize();
          }}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Maximize or restore"
          onClick={(event) => {
            event.stopPropagation();
            void currentWindow?.toggleMaximize();
          }}
        >
          <Maximize2 size={12} />
        </button>
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Close"
          onClick={(event) => {
            event.stopPropagation();
            void currentWindow?.close();
          }}
        >
          <X size={14} />
        </button>
      </div>
      <span className="titlebar-title">ZipTag</span>
    </div>
  );
}

type SidebarProps = {
  view: ActiveView;
  jobsCount: number;
  onViewChange: (view: ActiveView) => void;
};

function Sidebar({ view, jobsCount, onViewChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <FileArchive size={16} />
        </div>
        <span className="brand-name">ZipTag</span>
      </div>

      <NavGroup label="Main">
        <NavButton active={view === "compress"} icon={PackageCheck} label="Compress" onClick={() => onViewChange("compress")} />
        <NavButton active={view === "extract"} icon={ArchiveRestore} label="Extract" onClick={() => onViewChange("extract")} />
        <NavButton active={view === "queue"} icon={Layers} label="Queue" count={jobsCount} onClick={() => onViewChange("queue")} />
        <NavButton active={view === "themes"} icon={Palette} label="Themes" onClick={() => onViewChange("themes")} />
      </NavGroup>

      <NavGroup label="Info" compact>
        <NavButton active={view === "about"} icon={Info} label="About" onClick={() => onViewChange("about")} />
      </NavGroup>
    </aside>
  );
}

function NavGroup({ label, compact = false, children }: { label: string; compact?: boolean; children: React.ReactNode }) {
  return (
    <div className={compact ? "nav-group compact" : "nav-group"}>
      <span className="nav-group-label">{label}</span>
      {children}
    </div>
  );
}

type NavButtonProps = {
  active: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  count?: number;
  onClick: () => void;
};

function NavButton({ active, icon: Icon, label, count, onClick }: NavButtonProps) {
  return (
    <button type="button" onClick={onClick} className={cn("nav-item", active && "active")}>
      <Icon className="nav-icon" />
      <span>{label}</span>
      {typeof count === "number" && count > 0 ? <span className="nav-count">{count}</span> : null}
    </button>
  );
}

type CompressViewProps = {
  dropActive: boolean;
  paths: string[];
  outputPath: string;
  format: CreateFormat;
  level: CompressionLevel;
  password: string;
  onFormatChange: (value: CreateFormat) => void;
  onLevelChange: (value: CompressionLevel) => void;
  onPasswordChange: (value: string) => void;
  onPickFiles: () => void;
  onPickFolder: () => void;
  onPickOutput: () => void;
  onRun: () => void;
};

function CompressView(props: CompressViewProps) {
  const canRun = props.paths.length > 0 && props.outputPath;

  return (
    <TwoColumnPage title="Create a clean archive" subtitle="Compress files into any format." icon={PackageCheck}>
      <div className="page-left">
        <DropZone active={props.dropActive} icon={Upload} title="Drop files or folders">
          <div className="drop-actions">
            <button type="button" className="btn-primary" onClick={props.onPickFiles}>
              <Plus size={12} />
              Files
            </button>
            <button type="button" className="btn-secondary" onClick={props.onPickFolder}>
              <Folder size={12} />
              Folder
            </button>
          </div>
        </DropZone>

        {props.paths.length ? (
          <CompactList title={`${props.paths.length} selected`}>
            {props.paths.map((path) => (
              <PathRow key={path} path={path} />
            ))}
          </CompactList>
        ) : (
          <div className="file-hint">Drop files here or choose files to begin.</div>
        )}
      </div>

      <div className="page-right">
        <Panel title="Archive settings" description="Ready to compress">
          <Field label="Format">
            <Pills value={props.format} values={createFormats} onChange={(value) => props.onFormatChange(value as CreateFormat)} />
          </Field>
          <Field label="Compression">
            <CompressionPicker value={props.level} onChange={props.onLevelChange} />
          </Field>
          <Field label="Output">
            <InputButton value={props.outputPath || "Choose destination"} placeholder={!props.outputPath} onClick={props.onPickOutput} />
          </Field>
          <Field label="Password">
            <div className="pwd-wrap">
              <LockKeyhole size={13} />
              <input
                className="pwd-input"
                type="password"
                placeholder={props.format.startsWith("tar") ? "Not supported for TAR" : "Optional password"}
                value={props.password}
                disabled={props.format.startsWith("tar")}
                onChange={(e) => props.onPasswordChange(e.target.value)}
              />
            </div>
          </Field>
          <button type="button" className="btn-start" disabled={!canRun} onClick={props.onRun}>
            <Play size={14} />
            Start
          </button>
        </Panel>
      </div>
    </TwoColumnPage>
  );
}

type ExtractViewProps = {
  dropActive: boolean;
  archivePath: string;
  destinationPath: string;
  password: string;
  onPasswordChange: (value: string) => void;
  onPickArchive: () => void;
  onPickDestination: () => void;
  onRun: () => void;
};

function ExtractView(props: ExtractViewProps) {
  const canRun = props.archivePath && props.destinationPath;

  const supportsPassword = (path: string) => {
    const lower = path.toLowerCase();
    return lower.endsWith(".zip") || lower.endsWith(".7z") || lower.endsWith(".rar");
  };

  const hasPasswordSupport = supportsPassword(props.archivePath);

  return (
    <TwoColumnPage title="Open archives into a folder" subtitle="Extract any archive to a local folder." icon={ArchiveRestore}>
      <div className="page-left">
        <DropZone active={props.dropActive} icon={Download} title="Drop an archive">
          <div className="drop-actions">
            <button type="button" className="btn-primary" onClick={props.onPickArchive}>
              <FileArchive size={12} />
              Archive
            </button>
          </div>
        </DropZone>

        {props.archivePath ? (
          <CompactList title="Archive info">
            <PathRow path={props.archivePath} />
          </CompactList>
        ) : (
          <div className="file-hint">Drop an archive or choose one from disk.</div>
        )}
      </div>

      <div className="page-right">
        <Panel title="Extract settings" description="Ready to extract">
          <Field label="Destination">
            <InputButton value={props.destinationPath || "Choose folder"} placeholder={!props.destinationPath} onClick={props.onPickDestination} />
          </Field>
          <Field label="Password">
            <div className="pwd-wrap">
              <LockKeyhole size={13} />
              <input
                className="pwd-input"
                type="password"
                placeholder={props.archivePath && !hasPasswordSupport ? "Not supported for this format" : "Optional password"}
                value={props.password}
                disabled={props.archivePath ? !hasPasswordSupport : false}
                onChange={(e) => props.onPasswordChange(e.target.value)}
              />
            </div>
          </Field>
          <button type="button" className="btn-start" disabled={!canRun} onClick={props.onRun}>
            <FileArchive size={14} />
            Extract
          </button>
          <Field label="Supported input">
            <div className="supported-pills">
              {["zip", "7z", "tar.gz", "tar.xz", "tar.bz2", "tar.zst", "rar", "iso"].map((item) => (
                <span key={item} className={cn("spill", (item === "rar" || item === "iso") && "extract-only")}>
                  {item}
                </span>
              ))}
            </div>
            <div className="extract-note">Teal = extract only</div>
          </Field>
        </Panel>
      </div>
    </TwoColumnPage>
  );
}

function QueueView({
  jobs,
  recentReport,
  onClearCompleted,
}: {
  jobs: ZipTagJob[];
  recentReport?: ArchiveJobReport;
  onClearCompleted: () => void;
}) {
  return (
    <section className="queue-layout">
      <PageHeader title="Queue" subtitle="Sequential jobs, no noise." icon={Layers} />
      <div className="queue-cols">
        <div className="queue-jobs">
          <div className="queue-jobs-header">
            <div>
              <div className="queue-jobs-title">Jobs</div>
              <div className="queue-jobs-count">{jobs.length ? `${jobs.length} in this session` : "No jobs yet"}</div>
            </div>
            <button type="button" className="btn-clear" onClick={onClearCompleted}>
              Clear
            </button>
          </div>
          <div className="queue-jobs-body">
            {jobs.length ? (
              jobs.map((job) => <JobRow key={job.id} job={job} />)
            ) : (
              <div className="queue-empty">
                <Layers size={24} />
                <span className="queue-empty-text">No jobs yet</span>
              </div>
            )}
          </div>
        </div>
        <ReportCard report={recentReport} />
      </div>
    </section>
  );
}

function AboutView() {
  return (
    <section className="about-layout">
      <div className="about-card">
        <div className="about-top">
          <div className="about-app-icon">
            <FileArchive size={28} />
          </div>
          <div>
            <div className="about-app-name">
              ZipTag <span className="about-version">v0.1.0</span>
            </div>
            <div className="about-tagline">A fast, polished offline desktop archiver.</div>
          </div>
        </div>
        <div className="about-grid">
          <InfoLine label="Maker" value="Tahsan Ahmmed" />
          <InfoLine label="Stack" value="Tauri + Rust" />
          <InfoLine label="Network" value="Updater only" />
          <InfoLine label="Telemetry" value="None" />
        </div>
        <button type="button" className="btn-github" onClick={() => void openUrl("https://github.com/tahsanahmmed25/ZipTag")}>
          <GitBranch size={14} />
          GitHub repository
        </button>
      </div>
    </section>
  );
}

const THEMES: { id: ThemeId; name: string; description: string; circle: string }[] = [
  { id: "teal-clarity",  name: "Teal Clarity",  description: "Composed and calm.",                      circle: "#0d9488" },
  { id: "slate-mono",    name: "Slate Mono",    description: "Pure black and white.",                     circle: "#1f2937" },
  { id: "indigo-focus",  name: "Indigo Focus",  description: "Calm confidence.",  circle: "#4f46e5" },
  { id: "amber-warmth",  name: "Amber Warmth",  description: "Personal and warm.",              circle: "#d97706" },
];

function ThemesView({
  darkMode,
  theme,
  onDarkModeChange,
  onThemeChange,
}: {
  darkMode: boolean;
  theme: ThemeId;
  onDarkModeChange: (v: boolean) => void;
  onThemeChange: (v: ThemeId) => void;
}) {
  return (
    <section className="themes-layout">
      <PageHeader title="Themes" subtitle="Choose an accent color for the app." icon={Palette} />

      <div className="theme-dark-card">
        <div className="theme-dark-info">
          <div className="theme-dark-label">Dark mode</div>
          <div className="theme-dark-sub">Switch between light and dark interface</div>
        </div>
        <button
          type="button"
          className={cn("toggle", darkMode && "on")}
          aria-pressed={darkMode}
          aria-label="Toggle dark mode"
          onClick={() => onDarkModeChange(!darkMode)}
        />
      </div>

      <div className="theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn("theme-card", theme === t.id && "active")}
            onClick={() => onThemeChange(t.id)}
          >
            <span className="theme-circle" style={{ background: t.circle }} />
            <div className="theme-card-info">
              <div className="theme-card-name">{t.name}</div>
              <div className="theme-card-desc">{t.description}</div>
            </div>
            <div className={cn("theme-radio", theme === t.id && "checked")}>
              {theme === t.id ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function TwoColumnPage({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="page-two-col">
      <div className="page-column-wrap">
        <PageHeader title={title} subtitle={subtitle} icon={icon} />
        <div className="page-two-col-body">{children}</div>
      </div>
    </section>
  );
}

function PageHeader({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="page-header-wrap">
      <div className="page-header">
        <div className="page-title">
          <Icon className="page-title-icon" />
          {title}
        </div>
        <div className="page-subtitle">{subtitle}</div>
      </div>
      <span className="version-badge">v0.1.0</span>
    </div>
  );
}

function DropZone({
  active,
  icon: Icon,
  title,
  children,
}: {
  active: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("drop-zone", active && "active")}>
      <div className="drop-icon-wrap">
        <Icon size={20} />
      </div>
      <div className="drop-text">
        <div className="drop-title">{title}</div>
        <div className="drop-subtitle">Drop or choose from disk</div>
      </div>
      {children}
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="panel-card">
      <div>
        <div className="panel-title">{title}</div>
        <div className="panel-description">{description}</div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="section-label">{label}</div>
      {children}
    </div>
  );
}

function Pills({ value, values, onChange }: { value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div className="pills-row">
      {values.map((item) => (
        <button type="button" key={item} onClick={() => onChange(item)} className={cn("pill", value === item && "active")}>
          {item}
        </button>
      ))}
    </div>
  );
}

function CompressionPicker({ value, onChange }: { value: CompressionLevel; onChange: (value: CompressionLevel) => void }) {
  return (
    <div className="comp-row">
      {(["fast", "balanced", "maximum"] as const).map((item) => (
        <button type="button" key={item} className={cn("comp-btn", value === item && "active")} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

function InputButton({ value, placeholder, onClick }: { value: string; placeholder: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cn("input-field", placeholder && "placeholder")} onClick={onClick}>
      {value}
    </button>
  );
}

function CompactList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="compact-list">
      <div className="compact-list-title">{title}</div>
      <div className="compact-list-body">{children}</div>
    </div>
  );
}

function PathRow({ path }: { path: string }) {
  return (
    <div className="path-row">
      <FileArchive size={14} />
      <div className="path-main">
        <div className="path-name">{fileNameFromPath(path)}</div>
        <div className="path-dir">{shortPath(path)}</div>
      </div>
      <span className="path-size">--</span>
      <span className="path-kind">{pathKind(path)}</span>
    </div>
  );
}

function JobRow({ job }: { job: ZipTagJob }) {
  const StatusIcon = job.status === "done" ? CheckCircle2 : job.status === "failed" ? XCircle : job.status === "running" ? Sparkles : Circle;

  return (
    <div className="job-row">
      <StatusIcon className={cn("job-icon", job.status)} />
      <div className="job-main">
        <div className="job-title">{job.title}</div>
        <div className="job-subtitle">{fileNameFromPath(job.paths[0] ?? job.outputPath)}</div>
      </div>
      <span className="job-format">{job.format ?? job.kind}</span>
      <span className={cn("job-status", job.status)}>{job.status}</span>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} />
      </div>
      {job.status === "queued" || job.status === "running" ? (
        <button
          type="button"
          className="btn-cancel-job"
          onClick={async () => {
            try {
              await invoke("cancel_job", { jobId: job.id });
            } catch (err) {
              console.error("Failed to cancel job:", err);
            }
          }}
          title="Cancel job"
        >
          Cancel
        </button>
      ) : (
        <div />
      )}
      {job.error ? <div className="job-error">{job.error}</div> : null}
    </div>
  );
}

function ReportCard({ report }: { report?: ArchiveJobReport }) {
  return (
    <div className="queue-report">
      <div className="queue-report-header">
        <div className="queue-report-title">Report</div>
        <div className="queue-report-sub">{report ? "Last completed job" : "Waiting for a completed job"}</div>
      </div>
      <div className="queue-report-body">
        {report ? (
          <div className="report-metrics">
            <Metric label="Original" value={formatBytes(report.originalSize)} />
            <Metric label="Archive" value={formatBytes(report.archiveSize)} />
            <Metric label="Saved" value={`${report.savedPercent.toFixed(1)}%`} />
            <Metric label="Time" value={formatDuration(report.durationMs)} />
            <Metric label="Entries" value={String(report.entries)} />
          </div>
        ) : (
          "No report"
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="about-cell">
      <div className="about-cell-label">{label}</div>
      <div className="about-cell-value">{value}</div>
    </div>
  );
}

function shortPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts.length > 3 ? `.../${parts.slice(-3, -1).join("/")}` : normalized;
}

function pathKind(path: string) {
  const lower = path.toLowerCase();
  if (isArchivePath(path)) return "archive";
  if (lower.includes(".")) return "file";
  return "folder";
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

// ── Quick Compress Dialog ──────────────────────────────────────────────────
// Shown when ZipTag is launched via: ziptag --quick-compress <path1> [path2...]
function QuickCompressDialog({ initialPaths }: { initialPaths: string[] }) {
  const [fmt, setFmt] = useState<CreateFormat>("zip");
  const [lvl, setLvl] = useState<CompressionLevel>("balanced");
  const [outPath, setOutPath] = useState(() => defaultArchivePath(initialPaths, "zip"));
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");
  const jobId = useState(() => newJobId())[0];

  // Keep output path extension in sync with format choice
  useEffect(() => {
    setOutPath(defaultArchivePath(initialPaths, fmt));
  }, [fmt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for progress events from the backend
  useEffect(() => {
    if (!isTauriRuntime()) return;
    const unlisten = listen<BackendProgress>("ziptag-job-progress", ({ payload }) => {
      if (payload.jobId !== jobId) return;
      setProgress(Math.max(0, Math.min(100, payload.progress)));
      setMsg(payload.message);
    });
    return () => { void unlisten.then((f) => f()); };
  }, [jobId]);

  async function handleRun() {
    if (!isTauriRuntime() || !outPath) return;
    setStatus("running");
    setMsg("Starting…");
    try {
      await invoke("compress_archive", {
        request: {
          jobId,
          inputPaths: initialPaths,
          outputPath: outPath,
          format: fmt,
          level: lvl,
          password: password || undefined,
        },
      });
      setStatus("done");
      setMsg("Done!");
      setTimeout(() => void getCurrentWindow().close(), 1200);
    } catch (e) {
      setStatus("failed");
      setMsg(String(e));
    }
  }

  async function pickOut() {
    if (!isTauriRuntime()) return;
    const selected = await save({
      title: "Save archive",
      defaultPath: outPath,
      filters: [{ name: fmt.toUpperCase(), extensions: [fmt.split(".").pop() ?? fmt] }],
    });
    if (selected) setOutPath(selected);
  }

  return (
    <main className="app-window quick-mode">
      <Titlebar />
      <div className="quick-dialog">
        <div className="quick-dialog-header">
          <FileArchive size={15} />
          <span>Compress with ZipTag</span>
        </div>
        <div className="quick-dialog-body">
          <div className="quick-files">
            {initialPaths.map((p) => (
              <div key={p} className="quick-file">
                <FileArchive size={12} />
                <span>{fileNameFromPath(p)}</span>
              </div>
            ))}
          </div>
          <div className="quick-field">
            <div className="section-label">Format</div>
            <div className="pills-row">
              {createFormats.map((f) => (
                <button type="button" key={f} className={cn("pill", fmt === f && "active")} onClick={() => setFmt(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="quick-field">
            <div className="section-label">Level</div>
            <div className="comp-row">
              {(["fast", "balanced", "maximum"] as const).map((l) => (
                <button type="button" key={l} className={cn("comp-btn", lvl === l && "active")} onClick={() => setLvl(l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="quick-field">
            <div className="section-label">Output</div>
            <button type="button" className={cn("input-field", !outPath && "placeholder")} onClick={() => void pickOut()}>
              {outPath || "Choose destination…"}
            </button>
          </div>
          <div className="quick-field">
            <div className="section-label">Password</div>
            <input
              className="input-field"
              type="password"
              placeholder="Optional"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {msg && <div className={cn("quick-msg", status === "failed" && "error")}>{msg}</div>}
          {status === "running" && (
            <div className="quick-progress-track">
              <div className="quick-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="quick-dialog-footer">
          <button
            type="button"
            className="btn-start"
            onClick={() => void handleRun()}
            disabled={status === "running" || status === "done" || !outPath}
          >
            <Play size={14} />
            {status === "running" ? "Compressing…" : status === "done" ? "Done" : "Compress"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Quick Extract Dialog ───────────────────────────────────────────────────
// Shown when ZipTag is launched via: ziptag --quick-extract <archive>
function QuickExtractDialog({ initialArchivePath }: { initialArchivePath: string }) {
  const [dest, setDest] = useState(() => defaultExtractPath(initialArchivePath));
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");
  const jobId = useState(() => newJobId())[0];

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const unlisten = listen<BackendProgress>("ziptag-job-progress", ({ payload }) => {
      if (payload.jobId !== jobId) return;
      setProgress(Math.max(0, Math.min(100, payload.progress)));
      setMsg(payload.message);
    });
    return () => { void unlisten.then((f) => f()); };
  }, [jobId]);

  async function handleRun() {
    if (!isTauriRuntime() || !dest) return;
    setStatus("running");
    setMsg("Starting…");
    try {
      await invoke("extract_archive", {
        request: {
          jobId,
          archivePath: initialArchivePath,
          destinationPath: dest,
          password: password || undefined,
        },
      });
      setStatus("done");
      setMsg("Done!");
      setTimeout(() => void getCurrentWindow().close(), 1200);
    } catch (e) {
      setStatus("failed");
      setMsg(String(e));
    }
  }

  async function pickDest() {
    if (!isTauriRuntime()) return;
    const selected = await open({ directory: true, multiple: false, title: "Choose destination" });
    if (typeof selected === "string") setDest(selected);
  }

  return (
    <main className="app-window quick-mode">
      <Titlebar />
      <div className="quick-dialog">
        <div className="quick-dialog-header">
          <ArchiveRestore size={15} />
          <span>Extract with ZipTag</span>
        </div>
        <div className="quick-dialog-body">
          <div className="quick-files">
            <div className="quick-file">
              <FileArchive size={12} />
              <span>{fileNameFromPath(initialArchivePath)}</span>
            </div>
          </div>
          <div className="quick-field">
            <div className="section-label">Destination</div>
            <button type="button" className={cn("input-field", !dest && "placeholder")} onClick={() => void pickDest()}>
              {dest || "Choose destination…"}
            </button>
          </div>
          <div className="quick-field">
            <div className="section-label">Password</div>
            <input
              className="input-field"
              type="password"
              placeholder="If encrypted"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {msg && <div className={cn("quick-msg", status === "failed" && "error")}>{msg}</div>}
          {status === "running" && (
            <div className="quick-progress-track">
              <div className="quick-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="quick-dialog-footer">
          <button
            type="button"
            className="btn-start"
            onClick={() => void handleRun()}
            disabled={status === "running" || status === "done" || !dest}
          >
            <Download size={14} />
            {status === "running" ? "Extracting…" : status === "done" ? "Done" : "Extract"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default App;
