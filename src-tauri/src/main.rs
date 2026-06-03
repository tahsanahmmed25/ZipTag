// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Parse CLI arguments before handing control to Tauri.
    // Supported flags:
    //   --quick-compress <path1> [path2 ...]
    //   --quick-extract  <path>
    let args: Vec<String> = std::env::args().skip(1).collect();

    let mut mode = String::new();
    let mut paths: Vec<String> = Vec::new();
    let mut i = 0;

    while i < args.len() {
        match args[i].as_str() {
            "--quick-compress" => {
                mode = "compress".to_string();
                i += 1;
                // Collect all remaining non-flag arguments as input paths.
                while i < args.len() && !args[i].starts_with("--") {
                    paths.push(args[i].clone());
                    i += 1;
                }
            }
            "--quick-extract" => {
                mode = "extract".to_string();
                i += 1;
                if i < args.len() && !args[i].starts_with("--") {
                    paths.push(args[i].clone());
                    i += 1;
                }
            }
            _ => {
                i += 1;
            }
        }
    }

    // Communicate the launch mode to the library via environment variables.
    // We use the ASCII record-separator (\x1E) as a safe path delimiter.
    if !mode.is_empty() {
        // SAFETY: setting env vars before threads start is safe.
        unsafe {
            std::env::set_var("ZIPTAG_QUICK_MODE", &mode);
            std::env::set_var("ZIPTAG_QUICK_PATHS", paths.join("\x1E"));
        }
    }

    ziptag_lib::run();
}
