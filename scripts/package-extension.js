import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const releaseDir = path.join(projectRoot, 'release');
const crxKeyPath = path.join(releaseDir, 'moviepilot-tools.pem');
const manifestPath = existsSync(path.join(distDir, 'manifest.json'))
  ? path.join(distDir, 'manifest.json')
  : path.join(projectRoot, 'public', 'manifest.json');

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function assertDistReady() {
  if (!existsSync(distDir)) {
    throw new Error('dist 目录不存在，请先执行 vite build。');
  }
  if (!existsSync(path.join(distDir, 'manifest.json'))) {
    throw new Error('dist/manifest.json 不存在，请确认 Vite 构建已完成。');
  }
}

function createZip(zipPath, addEntries) {
  if (existsSync(zipPath)) {
    rmSync(zipPath, { force: true });
  }

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('warning', (error) => {
      if (error.code === 'ENOENT') {
        console.warn('[打包警告]', error.message);
        return;
      }

      reject(error);
    });
    archive.on('error', reject);

    archive.pipe(output);
    addEntries(archive);
    archive.finalize();
  });
}

function createExtensionZip(zipPath) {
  return createZip(zipPath, (archive) => {
    archive.directory(distDir, false);
  });
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function createCrx(crxPath) {
  const chromePath = findChromeExecutable();
  if (!chromePath) {
    throw new Error('未找到 Chrome/Edge 浏览器，无法生成 crx 安装文件。可设置 CHROME_PATH 指向 chrome.exe。');
  }

  const generatedCrxPath = `${distDir}.crx`;
  const generatedPemPath = `${distDir}.pem`;

  for (const outputPath of [crxPath, generatedCrxPath, generatedPemPath]) {
    if (existsSync(outputPath)) {
      rmSync(outputPath, { force: true });
    }
  }

  const args = [`--pack-extension=${distDir}`];
  if (existsSync(crxKeyPath)) {
    args.push(`--pack-extension-key=${crxKeyPath}`);
  }

  execFileSync(chromePath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (!existsSync(generatedCrxPath)) {
    throw new Error('Chrome/Edge 未生成 crx 文件。');
  }

  rmSync(crxPath, { force: true });
  renameSync(generatedCrxPath, crxPath);

  if (!existsSync(crxKeyPath) && existsSync(generatedPemPath)) {
    renameSync(generatedPemPath, crxKeyPath);
    console.log(`已生成并保存 CRX 私钥：${path.relative(projectRoot, crxKeyPath)}`);
  }
}

// 从 version.json 同步版本号到 package.json 和 manifest.json
const versionPath = path.join(projectRoot, 'version.json');
if (existsSync(versionPath)) {
  const versionData = JSON.parse(readFileSync(versionPath, 'utf8'));
  const version = versionData.version;
  if (version) {
    // 同步 package.json
    const pkgPath = path.join(projectRoot, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.version !== version) {
        pkg.version = version;
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        console.log(`[版本同步] 已更新 package.json 版本为 ${version}`);
      }
    }

    // 同步 public/manifest.json
    const publicManifestPath = path.join(projectRoot, 'public', 'manifest.json');
    if (existsSync(publicManifestPath)) {
      const manifest = JSON.parse(readFileSync(publicManifestPath, 'utf8'));
      if (manifest.version !== version) {
        manifest.version = version;
        writeFileSync(publicManifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
        console.log(`[版本同步] 已更新 public/manifest.json 版本为 ${version}`);
      }
    }

    // 同步 dist/manifest.json
    const distManifestPath = path.join(distDir, 'manifest.json');
    if (existsSync(distManifestPath)) {
      const manifest = JSON.parse(readFileSync(distManifestPath, 'utf8'));
      if (manifest.version !== version) {
        manifest.version = version;
        writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
        console.log(`[版本同步] 已更新 dist/manifest.json 版本为 ${version}`);
      }
    }
  }
}

assertDistReady();
mkdirSync(releaseDir, { recursive: true });

const manifest = readManifest();
const displayName = (manifest.name || 'MoviePilot Tools').replace(/\s+/g, '-');
const version = manifest.version || '0.0.0';
const artifactBaseName = `${displayName}-v${version}`;
const crxPath = path.join(releaseDir, `${artifactBaseName}.crx`);
const crxZipPath = path.join(releaseDir, `${artifactBaseName}-crx.zip`);
const extensionZipPath = path.join(releaseDir, `${artifactBaseName}.zip`);

createCrx(crxPath);
console.log(`已生成：${path.relative(projectRoot, crxPath)}`);

await createZip(crxZipPath, (archive) => {
  archive.file(crxPath, { name: path.basename(crxPath) });
});
console.log(`已生成：${path.relative(projectRoot, crxZipPath)}`);

await createExtensionZip(extensionZipPath);
console.log(`已生成：${path.relative(projectRoot, extensionZipPath)}`);
