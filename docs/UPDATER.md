# ZipTag Updater

ZipTag uses Tauri v2's updater plugin and checks GitHub Releases on launch.

The public key is already configured in `src-tauri/tauri.conf.json`.
The matching private key was generated outside the repository at:

`~/.tauri/ziptag-updater.key`

Before publishing real builds:

1. Move the private key into your preferred secret manager.
2. Use `TAURI_SIGNING_PRIVATE_KEY_PATH` or `TAURI_SIGNING_PRIVATE_KEY` in CI.
3. Publish `latest.json` to GitHub Releases with Tauri's expected static JSON shape.

The frontend updater hook is intentionally quiet: no update means no UI.
