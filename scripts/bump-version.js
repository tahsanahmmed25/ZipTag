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

// Read current version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
console.log(`Current version: ${currentVersion}`);

const parts = currentVersion.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Invalid version format: ${currentVersion}`);
  process.exit(1);
}

const [major, minor, patch] = parts;
const isPreRelease = major === 0;

const startsWithRelease = commitMsg.trim().toLowerCase().startsWith('release:');
const shouldTag = startsWithRelease || isManual;

let bumpType = 'none';

if (isPreRelease) {
  // Option A logic for 0.x.y pre-releases
  if (shouldTag) {
    // Increment minor version (e.g. 0.1.5 -> 0.2.0)
    bumpType = 'minor';
  } else if (/feat:/i.test(commitMsg) || /fix:/i.test(commitMsg) || /breaking\b|!:/i.test(commitMsg) || /BREAKING CHANGE/i.test(commitMsg)) {
    // Treat feat, fix, and breaking all as patch bump during pre-release
    bumpType = 'patch';
  }
} else {
  // Standard SemVer logic for >= 1.0.0
  if (/breaking\b|!:/i.test(commitMsg) || /BREAKING CHANGE/i.test(commitMsg)) {
    bumpType = 'major';
  } else if (/feat:/i.test(commitMsg) || startsWithRelease) {
    bumpType = 'minor';
  } else if (/fix:/i.test(commitMsg)) {
    bumpType = 'patch';
  }
}

console.log(`Determined bump type: ${bumpType}`);

let newVersion = currentVersion;
let shouldBump = false;

if (bumpType !== 'none') {
  shouldBump = true;
  let newMajor = major;
  let newMinor = minor;
  let newPatch = patch;

  if (bumpType === 'major') {
    newMajor += 1;
    newMinor = 0;
    newPatch = 0;
  } else if (bumpType === 'minor') {
    newMinor += 1;
    newPatch = 0;
  } else if (bumpType === 'patch') {
    newPatch += 1;
  }
  newVersion = `${newMajor}.${newMinor}.${newPatch}`;
}

console.log(`should_bump=${shouldBump}`);
console.log(`New version: ${newVersion}`);

if (shouldBump) {
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
}

console.log(`should_tag=${shouldTag}`);

// Write outputs to GitHub Actions output environment if available
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_version=${newVersion}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_bump=${shouldBump}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_tag=${shouldTag}\n`);
}
