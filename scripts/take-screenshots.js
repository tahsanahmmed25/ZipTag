import puppeteer from 'puppeteer';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('Screenshots');
const PORT = 1420;

// Setup directories
if (fs.existsSync(SCREENSHOTS_DIR)) {
  fs.rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
}
fs.mkdirSync(SCREENSHOTS_DIR);

console.log('Starting Vite dev server...');
const devServer = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true,
});

devServer.stdout.on('data', (data) => {
  console.log(`[Vite]: ${data.toString().trim()}`);
});

// Helper to check if server is up
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady() {
  try {
    const res = await fetch(`http://localhost:${PORT}`);
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

// Wait for dev server to be fully ready
let ready = false;
for (let i = 0; i < 30; i++) {
  if (await isServerReady()) {
    ready = true;
    break;
  }
  await wait(500);
}

if (!ready) {
  console.error('Vite dev server failed to start.');
  devServer.kill();
  process.exit(1);
}
console.log('Vite dev server is ready! Launching browser...');

const themes = [
  { id: 'teal-clarity', name: 'teal-clarity' },
  { id: 'slate-mono', name: 'slate-mono' },
  { id: 'indigo-focus', name: 'indigo-focus' },
  { id: 'amber-warmth', name: 'amber-warmth' }
];

const modes = ['light', 'dark'];

const pages = [
  { label: 'Compress', name: 'compress' },
  { label: 'Extract', name: 'extract' },
  { label: 'Queue', name: 'queue' },
  { label: 'Themes', name: 'themes' },
  { label: 'About', name: 'about' }
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Forward page console logs to terminal
  page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));

  await page.setViewport({
    width: 1024,
    height: 680,
    deviceScaleFactor: 4, // 4K+ UHD resolution (4096x2720)
  });

  console.log(`Navigating to http://localhost:${PORT}/ ...`);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });

  for (const theme of themes) {
    for (const mode of modes) {
      console.log(`\n======================================================`);
      console.log(`Setting up theme: ${theme.id} | mode: ${mode}`);
      console.log(`======================================================`);
      
      await page.evaluate((t, isDark) => {
        localStorage.setItem('ziptag_theme', t);
        localStorage.setItem('ziptag_dark', isDark ? 'true' : 'false');
      }, theme.id, mode === 'dark');
      
      // Reload to apply theme & mode safely
      await page.reload({ waitUntil: 'load' });
      await wait(1000); // Wait for React app to mount and apply styles

      // Seed the Zustand jobs store with mock items for a realistic UI look
      await page.evaluate(() => {
        const store = window.useJobStore;
        if (!store) {
          console.error('CRITICAL: window.useJobStore is not defined!');
          return;
        }
        store.setState({ jobs: [] });
        
        // Active/running job
        store.getState().addJob({
          id: 'job-1',
          kind: 'compress',
          title: 'photos_holiday_2026.zip',
          paths: ['/home/tahsan/Pictures/Holiday/'],
          outputPath: '/home/tahsan/Backups/photos_holiday_2026.zip',
          format: 'zip',
          status: 'running',
          progress: 68,
          message: 'Compressing holiday photos...'
        });

        // Completed job to show the ReportCard metrics panel
        store.getState().addJob({
          id: 'job-2',
          kind: 'compress',
          title: 'document_archive.7z',
          paths: ['/home/tahsan/Documents/Archive/'],
          outputPath: '/home/tahsan/Backups/document_archive.7z',
          format: '7z',
          status: 'done',
          progress: 100,
          message: 'Completed',
          report: {
            originalSize: 1024 * 1024 * 145.4, // 145.4 MB
            archiveSize: 1024 * 1024 * 34.2, // 34.2 MB
            savedPercent: 76.5,
            durationMs: 4230,
            entries: 1248
          }
        });
      });

      // Capture each page
      for (const p of pages) {
        // Navigate
        await page.evaluate((text) => {
          const buttons = Array.from(document.querySelectorAll('.nav-item'));
          const btn = buttons.find(b => b.textContent.includes(text));
          if (btn) btn.click();
        }, p.label);
        
        await wait(300); // Wait for transitions/renders

        const filename = `${p.name}-${theme.name}-${mode}.png`;
        const filepath = path.join(SCREENSHOTS_DIR, filename);
        
        await page.screenshot({ path: filepath });
        console.log(`Captured: ${filename}`);
      }
    }
  }

  console.log('All screenshots captured successfully!');
  await browser.close();
  devServer.kill();
  process.exit(0);
})().catch((err) => {
  console.error('Error during screenshot capture:', err);
  devServer.kill();
  process.exit(1);
});
