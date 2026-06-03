use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs::{self, File},
    io::{Read, Write, Seek},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Instant,
};
use tauri::{AppHandle, Emitter, State};
use walkdir::WalkDir;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

// Encoders / decoders
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use xz2::write::XzEncoder;
use xz2::read::XzDecoder;
use bzip2::write::BzEncoder;
use bzip2::read::BzDecoder;
use zstd::stream::write::Encoder as ZstdEncoder;
use zstd::stream::read::Decoder as ZstdDecoder;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompressRequest {
    job_id: String,
    input_paths: Vec<String>,
    output_path: String,
    format: String,
    level: String,
    password: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtractRequest {
    job_id: String,
    archive_path: String,
    destination_path: String,
    password: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct JobProgress {
    job_id: String,
    status: String,
    progress: f64,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobReport {
    job_id: String,
    original_size: u64,
    archive_size: u64,
    saved_percent: f64,
    duration_ms: u128,
    output_path: String,
    entries: usize,
}

struct PendingEntry {
    source: PathBuf,
    archive_name: String,
    is_dir: bool,
}

#[derive(Default, Clone)]
pub struct ArchiveState {
    pub cancelled_jobs: Arc<Mutex<HashSet<String>>>,
}

fn is_cancelled(state: &ArchiveState, job_id: &str) -> bool {
    if let Ok(cancelled) = state.cancelled_jobs.lock() {
        cancelled.contains(job_id)
    } else {
        false
    }
}

#[tauri::command]
fn cancel_job(state: State<'_, ArchiveState>, job_id: String) {
    if let Ok(mut cancelled) = state.cancelled_jobs.lock() {
        cancelled.insert(job_id);
    }
}

/// Returns the launch mode and paths when ZipTag is invoked from the OS
/// context menu (via --quick-compress or --quick-extract CLI flags).
/// Returns `{"mode": "", "paths": []}` for a normal launch.
#[tauri::command]
fn get_launch_mode() -> serde_json::Value {
    let mode = std::env::var("ZIPTAG_QUICK_MODE").unwrap_or_default();
    let raw_paths = std::env::var("ZIPTAG_QUICK_PATHS").unwrap_or_default();
    let paths: Vec<String> = if raw_paths.is_empty() {
        vec![]
    } else {
        raw_paths.split('\x1E').map(String::from).collect()
    };
    serde_json::json!({ "mode": mode, "paths": paths })
}

struct ProgressReader<'a, R> {
    reader: R,
    app: &'a AppHandle,
    job_id: &'a str,
    state: &'a ArchiveState,
    processed: &'a mut u64,
    total_size: u64,
    message: String,
}

impl<'a, R: Read> Read for ProgressReader<'a, R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if is_cancelled(self.state, self.job_id) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Interrupted,
                "Job cancelled by user",
            ));
        }

        let bytes_read = self.reader.read(buf)?;
        if bytes_read > 0 {
            *self.processed = self.processed.saturating_add(bytes_read as u64);
            let progress = (*self.processed as f64 / self.total_size as f64) * 100.0;
            emit_progress(
                self.app,
                self.job_id,
                "running",
                progress.min(99.0),
                &self.message,
            );
        }
        Ok(bytes_read)
    }
}

#[tauri::command]
async fn compress_archive(
    app: AppHandle,
    state: State<'_, ArchiveState>,
    request: CompressRequest,
) -> Result<JobReport, String> {
    let state_inner = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || compress_archive_blocking(app, state_inner, request))
        .await
        .map_err(to_error)?
}

fn compress_archive_blocking(
    app: AppHandle,
    state: ArchiveState,
    request: CompressRequest,
) -> Result<JobReport, String> {
    if request.input_paths.is_empty() {
        return Err("Choose at least one file or folder.".into());
    }

    let started = Instant::now();
    emit_progress(&app, &request.job_id, "running", 0.0, "Scanning inputs");

    let input_paths = request
        .input_paths
        .iter()
        .map(PathBuf::from)
        .collect::<Vec<_>>();
    let (entries, original_size) = collect_entries(&input_paths)?;

    if entries.is_empty() {
        return Err("No archiveable files found.".into());
    }

    let output_path = PathBuf::from(&request.output_path);
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }

    let total_size = original_size.max(1);
    let mut processed = 0_u64;

    // Dispatch by format
    match request.format.as_str() {
        "zip" => {
            let output_file = File::create(&output_path).map_err(to_error)?;
            let mut zip = ZipWriter::new(output_file).set_auto_large_file();

            let mut options = SimpleFileOptions::default()
                .compression_method(CompressionMethod::Deflated)
                .compression_level(Some(level_to_zip_value(&request.level)))
                .large_file(true);

            if let Some(ref pw) = request.password {
                options = options.with_aes_encryption(zip::AesMode::Aes256, pw);
            }

            for entry in &entries {
                if is_cancelled(&state, &request.job_id) {
                    let _ = fs::remove_file(&output_path);
                    return Err("Job cancelled".into());
                }

                emit_progress(
                    &app,
                    &request.job_id,
                    "running",
                    (processed as f64 / total_size as f64) * 100.0,
                    format!("Writing {}", entry.archive_name),
                );

                if entry.is_dir {
                    zip.add_directory(&entry.archive_name, options)
                        .map_err(to_error)?;
                    continue;
                }

                zip.start_file(&entry.archive_name, options)
                    .map_err(to_error)?;
                let file = File::open(&entry.source).map_err(to_error)?;
                let mut progress_reader = ProgressReader {
                    reader: file,
                    app: &app,
                    job_id: &request.job_id,
                    state: &state,
                    processed: &mut processed,
                    total_size,
                    message: format!("Writing {}", entry.archive_name),
                };
                std::io::copy(&mut progress_reader, &mut zip).map_err(|e| {
                    if is_cancelled(&state, &request.job_id) {
                        "Job cancelled".to_string()
                    } else {
                        e.to_string()
                    }
                })?;
            }
            zip.finish().map_err(to_error)?;
        }
        "7z" => {
            compress_7z(
                &entries, &output_path, request.password.clone(),
                &app, &request.job_id, &state, &mut processed, total_size,
            )?;
        }
        "tar.gz" => {
            let output_file = File::create(&output_path).map_err(to_error)?;
            let encoder = GzEncoder::new(output_file, compression_level_flate2(&request.level));
            let mut builder = tar::Builder::new(encoder);
            append_tar_entries(&mut builder, &entries, &app, &request.job_id, &state, &mut processed, total_size)?;
            let mut encoder = builder.into_inner().map_err(to_error)?;
            encoder.try_finish().map_err(to_error)?;
        }
        "tar.xz" => {
            let output_file = File::create(&output_path).map_err(to_error)?;
            let encoder = XzEncoder::new(output_file, compression_level_xz(&request.level));
            let mut builder = tar::Builder::new(encoder);
            append_tar_entries(&mut builder, &entries, &app, &request.job_id, &state, &mut processed, total_size)?;
            let encoder = builder.into_inner().map_err(to_error)?;
            encoder.finish().map_err(to_error)?;
        }
        "tar.bz2" => {
            let output_file = File::create(&output_path).map_err(to_error)?;
            let encoder = BzEncoder::new(output_file, compression_level_bz2(&request.level));
            let mut builder = tar::Builder::new(encoder);
            append_tar_entries(&mut builder, &entries, &app, &request.job_id, &state, &mut processed, total_size)?;
            let encoder = builder.into_inner().map_err(to_error)?;
            encoder.finish().map_err(to_error)?;
        }
        "tar.zst" => {
            let output_file = File::create(&output_path).map_err(to_error)?;
            let encoder = ZstdEncoder::new(output_file, compression_level_zstd(&request.level))
                .map_err(to_error)?
                .auto_finish();
            let mut builder = tar::Builder::new(encoder);
            append_tar_entries(&mut builder, &entries, &app, &request.job_id, &state, &mut processed, total_size)?;
            builder.finish().map_err(to_error)?;
        }
        "tar" => {
            let output_file = File::create(&output_path).map_err(to_error)?;
            let mut builder = tar::Builder::new(output_file);
            append_tar_entries(&mut builder, &entries, &app, &request.job_id, &state, &mut processed, total_size)?;
            builder.finish().map_err(to_error)?;
        }
        _ => return Err(format!("Unsupported format: {}", request.format)),
    }

    if is_cancelled(&state, &request.job_id) {
        let _ = fs::remove_file(&output_path);
        return Err("Job cancelled".into());
    }

    let archive_size = fs::metadata(&output_path).map_err(to_error)?.len();
    let saved_percent = if original_size == 0 {
        0.0
    } else {
        ((original_size as f64 - archive_size as f64) / original_size as f64) * 100.0
    };

    emit_progress(&app, &request.job_id, "done", 100.0, "Complete");

    Ok(JobReport {
        job_id: request.job_id,
        original_size,
        archive_size,
        saved_percent,
        duration_ms: started.elapsed().as_millis(),
        output_path: output_path.to_string_lossy().to_string(),
        entries: entries.len(),
    })
}

#[tauri::command]
async fn extract_archive(
    app: AppHandle,
    state: State<'_, ArchiveState>,
    request: ExtractRequest,
) -> Result<JobReport, String> {
    let state_inner = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || extract_archive_blocking(app, state_inner, request))
        .await
        .map_err(to_error)?
}

fn extract_archive_blocking(
    app: AppHandle,
    state: ArchiveState,
    request: ExtractRequest,
) -> Result<JobReport, String> {
    let started = Instant::now();
    emit_progress(&app, &request.job_id, "running", 0.0, "Opening archive");

    let archive_path = PathBuf::from(&request.archive_path);
    let destination = PathBuf::from(&request.destination_path);
    fs::create_dir_all(&destination).map_err(to_error)?;

    let archive_size = fs::metadata(&archive_path).map_err(to_error)?.len();
    let lower_path = request.archive_path.to_lowercase();

    let mut original_size = 0_u64;
    let mut entries_count = 0_usize;

    if lower_path.ends_with(".zip") {
        let archive_file = File::open(&archive_path).map_err(to_error)?;
        let mut archive = ZipArchive::new(archive_file).map_err(to_error)?;

        for index in 0..archive.len() {
            let file = archive.by_index(index).map_err(to_error)?;
            original_size = original_size.saturating_add(file.size());
        }

        let total_size = original_size.max(1);
        let mut processed = 0_u64;

        for index in 0..archive.len() {
            if is_cancelled(&state, &request.job_id) {
                return Err("Job cancelled".into());
            }

            let file = archive.by_index(index).map_err(to_error)?;
            let is_encrypted = file.encrypted();
            let is_dir = file.is_dir();
            let name = file.name().to_string();
            let safe_name = file
                .enclosed_name()
                .ok_or_else(|| format!("Blocked unsafe archive path: {}", name))?
                .to_path_buf();
            
            // Drop file to release mutable borrow of archive
            drop(file);

            let outpath = destination.join(&safe_name);

            emit_progress(
                &app,
                &request.job_id,
                "running",
                (processed as f64 / total_size as f64) * 100.0,
                format!("Extracting {}", name),
            );

            if is_dir {
                fs::create_dir_all(&outpath).map_err(to_error)?;
                entries_count += 1;
                continue;
            }

            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(to_error)?;
            }

            let mut file = if is_encrypted {
                if let Some(ref pw) = request.password {
                    archive.by_index_decrypt(index, pw.as_bytes()).map_err(to_error)?
                } else {
                    return Err("Archive is encrypted. Please provide a password.".into());
                }
            } else {
                archive.by_index(index).map_err(to_error)?
            };

            let mut outfile = File::create(&outpath).map_err(to_error)?;
            let mut file_buffer = [0_u8; 128 * 1024];
            loop {
                if is_cancelled(&state, &request.job_id) {
                    return Err("Job cancelled".into());
                }
                let read = file.read(&mut file_buffer).map_err(to_error)?;
                if read == 0 {
                    break;
                }
                outfile.write_all(&file_buffer[..read]).map_err(to_error)?;
                processed = processed.saturating_add(read as u64);
                
                let progress = (processed as f64 / total_size as f64) * 100.0;
                emit_progress(
                    &app,
                    &request.job_id,
                    "running",
                    progress.min(99.0),
                    format!("Extracting {}", file.name()),
                );
            }
            entries_count += 1;
        }
    } else if lower_path.ends_with(".7z") {
        if let Some(ref pw) = request.password {
            sevenz_rust2::decompress_file_with_password(&archive_path, &destination, pw.as_str().into())
                .map_err(to_error)?;
        } else {
            sevenz_rust2::decompress_file(&archive_path, &destination)
                .map_err(to_error)?;
        }
        entries_count = 1;
    } else if lower_path.ends_with(".rar") {
        let pw = request.password.clone().unwrap_or_default();
        let _ = rar::Archive::extract_all(
            &request.archive_path,
            &request.destination_path,
            &pw
        ).map_err(to_error)?;
        entries_count = 1;
    } else if lower_path.ends_with(".iso") {
        entries_count = extract_iso(&archive_path, &destination, &app, &request.job_id, &state)?;
    } else if lower_path.ends_with(".tar.gz") || lower_path.ends_with(".tgz") {
        let mut processed = 0_u64;
        let file = File::open(&archive_path).map_err(to_error)?;
        let pr = ProgressReader {
            reader: file,
            app: &app,
            job_id: &request.job_id,
            state: &state,
            processed: &mut processed,
            total_size: archive_size,
            message: "Decompressing gzip".into(),
        };
        let decoder = GzDecoder::new(pr);
        let archive = tar::Archive::new(decoder);
        entries_count = extract_tar_archive(archive, &destination, &app, &request.job_id, &state)?;
    } else if lower_path.ends_with(".tar.xz") {
        let mut processed = 0_u64;
        let file = File::open(&archive_path).map_err(to_error)?;
        let pr = ProgressReader {
            reader: file,
            app: &app,
            job_id: &request.job_id,
            state: &state,
            processed: &mut processed,
            total_size: archive_size,
            message: "Decompressing xz".into(),
        };
        let decoder = XzDecoder::new(pr);
        let archive = tar::Archive::new(decoder);
        entries_count = extract_tar_archive(archive, &destination, &app, &request.job_id, &state)?;
    } else if lower_path.ends_with(".tar.bz2") {
        let mut processed = 0_u64;
        let file = File::open(&archive_path).map_err(to_error)?;
        let pr = ProgressReader {
            reader: file,
            app: &app,
            job_id: &request.job_id,
            state: &state,
            processed: &mut processed,
            total_size: archive_size,
            message: "Decompressing bzip2".into(),
        };
        let decoder = BzDecoder::new(pr);
        let archive = tar::Archive::new(decoder);
        entries_count = extract_tar_archive(archive, &destination, &app, &request.job_id, &state)?;
    } else if lower_path.ends_with(".tar.zst") {
        let mut processed = 0_u64;
        let file = File::open(&archive_path).map_err(to_error)?;
        let pr = ProgressReader {
            reader: file,
            app: &app,
            job_id: &request.job_id,
            state: &state,
            processed: &mut processed,
            total_size: archive_size,
            message: "Decompressing zstd".into(),
        };
        let decoder = ZstdDecoder::new(pr).map_err(to_error)?;
        let archive = tar::Archive::new(decoder);
        entries_count = extract_tar_archive(archive, &destination, &app, &request.job_id, &state)?;
    } else if lower_path.ends_with(".tar") {
        let mut processed = 0_u64;
        let file = File::open(&archive_path).map_err(to_error)?;
        let pr = ProgressReader {
            reader: file,
            app: &app,
            job_id: &request.job_id,
            state: &state,
            processed: &mut processed,
            total_size: archive_size,
            message: "Reading tar archive".into(),
        };
        let archive = tar::Archive::new(pr);
        entries_count = extract_tar_archive(archive, &destination, &app, &request.job_id, &state)?;
    } else {
        return Err("Unsupported archive format".into());
    }

    emit_progress(&app, &request.job_id, "done", 100.0, "Complete");

    Ok(JobReport {
        job_id: request.job_id,
        original_size,
        archive_size,
        saved_percent: 0.0,
        duration_ms: started.elapsed().as_millis(),
        output_path: destination.to_string_lossy().to_string(),
        entries: entries_count,
    })
}

fn collect_entries(input_paths: &[PathBuf]) -> Result<(Vec<PendingEntry>, u64), String> {
    let mut entries = Vec::new();
    let mut total_size = 0_u64;

    for input in input_paths {
        if input.is_file() {
            let file_name = input
                .file_name()
                .ok_or_else(|| format!("Invalid file path: {}", input.display()))?;
            let size = fs::metadata(input).map_err(to_error)?.len();
            total_size = total_size.saturating_add(size);
            entries.push(PendingEntry {
                source: input.clone(),
                archive_name: path_to_archive_name(Path::new(file_name)),
                is_dir: false,
            });
            continue;
        }

        if input.is_dir() {
            let base = input.parent().unwrap_or_else(|| Path::new(""));
            for item in WalkDir::new(input).follow_links(false) {
                let item = item.map_err(to_error)?;
                let path = item.path().to_path_buf();
                let relative = path.strip_prefix(base).map_err(to_error)?;
                let archive_name = path_to_archive_name(relative);
                let metadata = item.metadata().map_err(to_error)?;

                if metadata.file_type().is_symlink() {
                    continue;
                }

                if metadata.is_dir() {
                    entries.push(PendingEntry {
                        source: path,
                        archive_name: ensure_directory_name(&archive_name),
                        is_dir: true,
                    });
                } else if metadata.is_file() {
                    let size = metadata.len();
                    total_size = total_size.saturating_add(size);
                    entries.push(PendingEntry {
                        source: path,
                        archive_name,
                        is_dir: false,
                    });
                }
            }
            continue;
        }

        return Err(format!("Input path does not exist: {}", input.display()));
    }

    entries.sort_by(|a, b| a.archive_name.cmp(&b.archive_name));
    Ok((entries, total_size))
}

fn path_to_archive_name(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn ensure_directory_name(value: &str) -> String {
    if value.ends_with('/') {
        value.to_string()
    } else {
        format!("{value}/")
    }
}

fn level_to_zip_value(level: &str) -> i64 {
    match level {
        "fast" => 1,
        "maximum" => 9,
        _ => 6,
    }
}

fn emit_progress(
    app: &AppHandle,
    job_id: &str,
    status: impl Into<String>,
    progress: f64,
    message: impl Into<String>,
) {
    let _ = app.emit(
        "ziptag-job-progress",
        JobProgress {
            job_id: job_id.to_string(),
            status: status.into(),
            progress,
            message: message.into(),
        },
    );
}

fn to_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn compress_7z(
    entries: &[PendingEntry],
    output_path: &Path,
    password: Option<String>,
    app: &AppHandle,
    job_id: &str,
    state: &ArchiveState,
    processed: &mut u64,
    total_size: u64,
) -> Result<(), String> {
    use sevenz_rust2::{ArchiveEntry as SzEntry, ArchiveWriter, EncoderConfiguration, EncoderMethod};

    let mut writer = ArchiveWriter::create(output_path).map_err(to_error)?;

    if let Some(ref pw) = password {
        use sevenz_rust2::Password;
        use sevenz_rust2::encoder_options::AesEncoderOptions;
        let aes_opts = AesEncoderOptions::new(Password::from(pw.as_str()));
        writer.set_content_methods(vec![
            EncoderConfiguration::from(aes_opts),
            EncoderConfiguration::new(EncoderMethod::LZMA2),
        ]);
    }

    for entry in entries {
        if is_cancelled(state, job_id) {
            drop(writer);
            let _ = fs::remove_file(output_path);
            return Err("Job cancelled".into());
        }

        emit_progress(
            app,
            job_id,
            "running",
            (*processed as f64 / total_size as f64) * 100.0,
            format!("Writing {}", entry.archive_name),
        );

        if entry.is_dir {
            writer
                .push_archive_entry(SzEntry::new_directory(&entry.archive_name), None::<File>)
                .map_err(to_error)?;
            continue;
        }

        let file = File::open(&entry.source).map_err(to_error)?;
        let pr = ProgressReader {
            reader: file,
            app,
            job_id,
            state,
            processed,
            total_size,
            message: format!("Writing {}", entry.archive_name),
        };

        writer
            .push_archive_entry(
                SzEntry::from_path(&entry.source, entry.archive_name.clone()),
                Some(pr),
            )
            .map_err(|e| {
                if is_cancelled(state, job_id) {
                    "Job cancelled".to_string()
                } else {
                    e.to_string()
                }
            })?;
    }

    if is_cancelled(state, job_id) {
        drop(writer);
        let _ = fs::remove_file(output_path);
        return Err("Job cancelled".into());
    }

    writer.finish().map(|_| ()).map_err(to_error)?;
    Ok(())
}

fn append_tar_entries<W: Write>(
    builder: &mut tar::Builder<W>,
    entries: &[PendingEntry],
    app: &AppHandle,
    job_id: &str,
    state: &ArchiveState,
    processed: &mut u64,
    total_size: u64,
) -> Result<(), String> {
    for entry in entries {
        if is_cancelled(state, job_id) {
            return Err("Job cancelled".into());
        }

        if entry.is_dir {
            builder.append_dir(&entry.archive_name, &entry.source).map_err(to_error)?;
            continue;
        }

        let file = File::open(&entry.source).map_err(to_error)?;
        let metadata = file.metadata().map_err(to_error)?;
        let mut header = tar::Header::new_gnu();
        header.set_metadata(&metadata);
        header.set_path(&entry.archive_name).map_err(to_error)?;

        let mut progress_reader = ProgressReader {
            reader: file,
            app,
            job_id,
            state,
            processed,
            total_size,
            message: format!("Writing {}", entry.archive_name),
        };

        builder.append(&header, &mut progress_reader).map_err(to_error)?;
    }
    Ok(())
}

fn compression_level_flate2(level: &str) -> flate2::Compression {
    match level {
        "fast" => flate2::Compression::fast(),
        "maximum" => flate2::Compression::best(),
        _ => flate2::Compression::new(6),
    }
}

fn compression_level_xz(level: &str) -> u32 {
    match level {
        "fast" => 1,
        "maximum" => 9,
        _ => 6,
    }
}

fn compression_level_bz2(level: &str) -> bzip2::Compression {
    match level {
        "fast" => bzip2::Compression::fast(),
        "maximum" => bzip2::Compression::best(),
        _ => bzip2::Compression::new(6),
    }
}

fn compression_level_zstd(level: &str) -> i32 {
    match level {
        "fast" => 1,
        "maximum" => 19,
        _ => 6,
    }
}

fn extract_tar_archive<R: Read>(
    mut archive: tar::Archive<R>,
    destination: &Path,
    _app: &AppHandle,
    job_id: &str,
    state: &ArchiveState,
) -> Result<usize, String> {
    let mut entries_count = 0;
    let entries = archive.entries().map_err(to_error)?;
    for entry in entries {
        if is_cancelled(state, job_id) {
            return Err("Job cancelled".into());
        }
        let mut entry = entry.map_err(to_error)?;
        let path = entry.path().map_err(to_error)?.to_path_buf();
        let outpath = destination.join(path);
        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent).map_err(to_error)?;
        }
        entry.unpack(&outpath).map_err(to_error)?;
        entries_count += 1;
    }
    Ok(entries_count)
}

fn extract_iso(
    archive_path: &Path,
    destination: &Path,
    app: &AppHandle,
    job_id: &str,
    state: &ArchiveState,
) -> Result<usize, String> {
    let file = File::open(archive_path).map_err(to_error)?;
    let image = hadris_iso::read::IsoImage::open(file).map_err(to_error)?;
    let root = image.root_dir();
    let root_dir = root.iter(&image);
    let mut entries_count = 0;
    extract_iso_dir(&image, &root_dir, destination, app, job_id, state, &mut entries_count)?;
    Ok(entries_count)
}

fn extract_iso_dir<R: Read + Seek>(
    image: &hadris_iso::read::IsoImage<R>,
    dir: &hadris_iso::read::IsoDir<'_, R>,
    dest: &Path,
    app: &AppHandle,
    job_id: &str,
    state: &ArchiveState,
    entries_count: &mut usize,
) -> Result<(), String> {
    for entry in dir.entries() {
        if is_cancelled(state, job_id) {
            return Err("Job cancelled".into());
        }
        let entry = entry.map_err(to_error)?;
        let name_bytes = entry.name();
        if name_bytes == b"." || name_bytes == b".." {
            continue;
        }
        
        let name_str = String::from_utf8_lossy(name_bytes).to_string();
        let name_clean = if let Some(idx) = name_str.find(';') {
            &name_str[..idx]
        } else {
            &name_str
        };
        
        let outpath = dest.join(name_clean);
        
        if entry.is_directory() {
            fs::create_dir_all(&outpath).map_err(to_error)?;
            let sub_dir_ref = entry.as_dir_ref(image).map_err(to_error)?;
            let sub_dir = image.open_dir(sub_dir_ref);
            extract_iso_dir(image, &sub_dir, &outpath, app, job_id, state, entries_count)?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(to_error)?;
            }
            
            let file_data = image.read_file(&entry).map_err(to_error)?;
            let mut outfile = File::create(&outpath).map_err(to_error)?;
            outfile.write_all(&file_data).map_err(to_error)?;
            *entries_count += 1;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ArchiveState::default())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            compress_archive,
            extract_archive,
            cancel_job,
            get_launch_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
