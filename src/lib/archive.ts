export const createFormats = ["zip", "7z", "tar.gz", "tar.xz", "tar.bz2", "tar.zst"] as const;
export const extractFormats = [...createFormats, "rar", "iso"] as const;
export const compressionLevels = ["fast", "balanced", "maximum"] as const;

export type CreateFormat = (typeof createFormats)[number];
export type ExtractFormat = (typeof extractFormats)[number];
export type CompressionLevel = (typeof compressionLevels)[number];

export type ArchiveJobReport = {
  jobId: string;
  originalSize: number;
  archiveSize: number;
  savedPercent: number;
  durationMs: number;
  outputPath: string;
  entries: number;
};

export type BackendProgress = {
  jobId: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: number;
  message: string;
};

const archiveExtensions = [
  ".tar.gz",
  ".tar.xz",
  ".tar.bz2",
  ".tar.zst",
  ".zip",
  ".7z",
  ".rar",
  ".iso",
];

export function isArchivePath(path: string) {
  const lower = path.toLowerCase();
  return archiveExtensions.some((ext) => lower.endsWith(ext));
}

export function fileNameFromPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || normalized;
}

export function parentDir(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : "";
}

export function stripKnownArchiveExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  const ext = archiveExtensions.find((candidate) => lower.endsWith(candidate));
  return ext ? fileName.slice(0, -ext.length) : fileName.replace(/\.[^/.]+$/, "");
}

export function defaultArchivePath(paths: string[], format: CreateFormat) {
  const first = paths[0] ?? "Archive";
  const parent = parentDir(first);
  const base = stripKnownArchiveExtension(fileNameFromPath(first)) || "Archive";
  const name = `${base}.${format}`;
  return parent ? `${parent}/${name}` : name;
}

export function defaultExtractPath(path: string) {
  const parent = parentDir(path);
  const base = stripKnownArchiveExtension(fileNameFromPath(path)) || "Extracted";
  return parent ? `${parent}/${base}` : base;
}

export function newJobId() {
  return crypto.randomUUID?.() ?? `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
