import { check } from "@tauri-apps/plugin-updater";

export async function runSilentUpdateCheck(onStatus: (message: string | null) => void) {
  try {
    const update = await check();

    if (!update) {
      return;
    }

    onStatus(`A new version of ZipTag is available. Installing ${update.version}...`);
    await update.downloadAndInstall();
  } catch (error) {
    console.info("ZipTag updater is not active in this build yet.", error);
  }
}
