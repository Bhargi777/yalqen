// Run a local Electron build with its own macOS bundle identity and icon.
// The installed Electron.app keeps its original files; our branded copy is in dist/.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const { productName } = require('../package.json');
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(project, '../..');

function brandedMacApp() {
  const source = path.dirname(path.resolve(electronBinary, '../..'));
  const destination = path.join(project, 'dist', `${productName}.app`);
  const sourceBinary = path.join(source, 'Contents', 'MacOS', 'Electron');
  const stamp = path.join(destination, 'Contents', 'Resources', '.yalqen-source.json');
  const binaryStat = fs.statSync(sourceBinary);
  const identity = { source, size: binaryStat.size, modified: binaryStat.mtimeMs };

  let current = null;
  try {
    current = JSON.parse(fs.readFileSync(stamp, 'utf8'));
  } catch {
    // First build, or Electron was reinstalled.
  }
  if (JSON.stringify(current) !== JSON.stringify(identity)) {
    fs.rmSync(destination, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    execFileSync('ditto', [source, destination]);
    fs.writeFileSync(stamp, JSON.stringify(identity));
  }

  const plist = path.join(destination, 'Contents', 'Info.plist');
  for (const [key, value] of Object.entries({
    CFBundleName: productName,
    CFBundleDisplayName: productName,
    CFBundleIdentifier: 'com.yalqen.browser.prototype',
    CFBundleIconFile: 'yalqen.icns',
  })) {
    execFileSync('plutil', ['-replace', key, '-string', value, plist]);
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yalqen-icon-'));
  const iconset = path.join(temp, 'yalqen.iconset');
  fs.mkdirSync(iconset);
  try {
    const png = path.join(repo, 'design', 'brand', 'png');
    for (const [name, size] of [
      ['icon_16x16.png', 16],
      ['icon_16x16@2x.png', 32],
      ['icon_32x32.png', 32],
      ['icon_32x32@2x.png', 64],
      ['icon_128x128.png', 128],
      ['icon_128x128@2x.png', 256],
      ['icon_256x256.png', 256],
      ['icon_256x256@2x.png', 512],
      ['icon_512x512.png', 512],
      ['icon_512x512@2x.png', 1024],
    ]) {
      fs.copyFileSync(path.join(png, `icon-${size}.png`), path.join(iconset, name));
    }
    execFileSync('iconutil', [
      '-c', 'icns', '-o',
      path.join(destination, 'Contents', 'Resources', 'yalqen.icns'),
      iconset,
    ]);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', destination]);
  const now = new Date();
  fs.utimesSync(destination, now, now);
  return path.join(destination, 'Contents', 'MacOS', 'Electron');
}

const executable = process.platform === 'darwin' ? brandedMacApp() : electronBinary;
if (process.argv.includes('--prepare-only')) {
  console.log(path.resolve(executable, '../../..'));
} else {
  const child = spawn(executable, [project], { cwd: project, stdio: 'inherit' });
  child.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
