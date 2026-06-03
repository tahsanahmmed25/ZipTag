import fs from 'fs';
import path from 'path';

// Load files
const packageJsonPath = path.resolve('package.json');
const tauriConfPath = path.resolve('src-tauri/tauri.conf.json');
const cargoTomlPath = path.resolve('src-tauri/Cargo.toml');

const commitMsg = process.env.COMMIT_MESSAGE || '';
const isManual = process.env.IS_MANUAL === 'true';

console.log(`Commit message: "${commitMsg}"`);
console.log(`Manual trigger: ${isManual}`);

// Determine bump type
let bumpType = 'patch'; // default

if (/breaking\b|!:/i.test(commitMsg) || /BREAKING CHANGE/i.test(commitMsg)) {
  bumpType = 'major';
} else if (/feat:/i.test(commitMsg)) {
  bumpType = 'minor';
} else if (/fix:/i.test(commitMsg)) {
  bumpType = 'patch';
}

console.log(`Determined bump type: ${bumpType}`);

// Read current version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
console.log(`Current version: ${currentVersion}`);

const parts = currentVersion.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Invalid version format: ${currentVersion}`);
  process.exit(1);
}

let [major, minor, patch] = parts;
if (bumpType === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bumpType === 'minor') {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const newVersion = `${major}.${minor}.${patch}`;
console.log(`New version: ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log(`Updated package.json to ${newVersion}`);

// Update tauri.conf.json
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
  console.log(`Updated tauri.conf.json to ${newVersion}`);
}

// Update Cargo.toml
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(/^version = ".*"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');
  console.log(`Updated src-tauri/Cargo.toml to ${newVersion}`);
}

// Determine if we should create a release tag
const startsWithRelease = commitMsg.trim().toLowerCase().startsWith('release:');
const shouldTag = startsWithRelease || isManual;

console.log(`should_tag=${shouldTag}`);
console.log(`new_version=${newVersion}`);

// Write outputs to GitHub Actions output environment if available
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_version=${newVersion}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_tag=${shouldTag}\n`);
}
