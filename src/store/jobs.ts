import { create } from "zustand";
import type { ArchiveJobReport, BackendProgress, CompressionLevel, CreateFormat } from "@/lib/archive";

export type JobKind = "compress" | "extract";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export type ZipTagJob = {
  id: string;
  kind: JobKind;
  title: string;
  paths: string[];
  outputPath: string;
  format?: CreateFormat;
  level?: CompressionLevel;
  status: JobStatus;
  progress: number;
  message: string;
  report?: ArchiveJobReport;
  error?: string;
};

type JobState = {
  jobs: ZipTagJob[];
  appVersion: string;
  setAppVersion: (version: string) => void;
  addJob: (job: ZipTagJob) => void;
  applyProgress: (progress: BackendProgress) => void;
  completeJob: (jobId: string, report: ArchiveJobReport) => void;
  failJob: (jobId: string, error: string) => void;
  clearCompleted: () => void;
};

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  appVersion: "...",
  setAppVersion: (appVersion) => set({ appVersion }),
  addJob: (job) => set((state) => ({ jobs: [job, ...state.jobs] })),
  applyProgress: (progress) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === progress.jobId
          ? {
              ...job,
              status: progress.status,
              progress: Math.max(0, Math.min(100, progress.progress)),
              message: progress.message,
            }
          : job,
      ),
    })),
  completeJob: (jobId, report) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "done",
              progress: 100,
              message: "Complete",
              report,
            }
          : job,
      ),
    })),
  failJob: (jobId, error) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "failed",
              message: "Failed",
              error,
            }
          : job,
      ),
    })),
  clearCompleted: () =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.status !== "done" && job.status !== "failed"),
    })),
}));
