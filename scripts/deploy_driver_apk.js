/**
 * ============================================================================
 * Rudraksha Packers & Movers - Driver App Auto-Deployment & Release Pipeline
 * ============================================================================
 * Usage:
 *   node scripts/deploy_driver_apk.js [version] [versionCode]
 * Example:
 *   node scripts/deploy_driver_apk.js           (auto-bumps patch version)
 *   node scripts/deploy_driver_apk.js 1.2.4 6   (explicit version)
 * ============================================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.resolve(__dirname, '..');
const DRIVER_APP_DIR = path.join(ROOT_DIR, 'driver_app');
const PUBSPEC_PATH = path.join(DRIVER_APP_DIR, 'pubspec.yaml');
const UPDATE_SERVICE_PATH = path.join(DRIVER_APP_DIR, 'lib/services/update_service.dart');
const SERVER_JS_PATH = path.join(ROOT_DIR, 'Backend/server.js');
const BUILT_APK_PATH = path.join(DRIVER_APP_DIR, 'build/app/outputs/flutter-apk/app-release.apk');
const DEST_APK_PATH = path.join(ROOT_DIR, 'Frontend/downloads/RudrakshaDriver.apk');

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const stdout = execSync('powershell -Command "echo \'protocol=https`nhost=github.com\' | git credential fill"', { encoding: 'utf-8' });
    const match = stdout.match(/password=(.*)/);
    if (match) return match[1].trim();
  } catch (_) {}
  return '';
}

const GITHUB_TOKEN = getGitHubToken();
const GITHUB_OWNER = 'rudrakshamovers1460-rgb';
const GITHUB_REPO = 'Rudraksha_packers_movers';

function log(msg, symbol = 'ℹ️') {
  console.log(`\x1b[36m[Deploy Pipeline] ${symbol} ${msg}\x1b[0m`);
}
function success(msg) {
  console.log(`\x1b[32m[Deploy Pipeline] ✅ ${msg}\x1b[0m`);
}
function err(msg) {
  console.error(`\x1b[31m[Deploy Pipeline] ❌ ${msg}\x1b[0m`);
}

function parseCurrentVersion() {
  const content = fs.readFileSync(PUBSPEC_PATH, 'utf-8');
  const match = content.match(/^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/m);
  if (!match) throw new Error('Could not parse version from pubspec.yaml');
  return { version: match[1], code: parseInt(match[2], 10) };
}

function computeNextVersion(currentVer, currentCode) {
  const parts = currentVer.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return {
    nextVer: parts.join('.'),
    nextCode: currentCode + 1
  };
}

function syncVersionFiles(version, versionCode) {
  log(`Syncing version v${version}+${versionCode} across files...`);

  // 1. pubspec.yaml
  let pubspec = fs.readFileSync(PUBSPEC_PATH, 'utf-8');
  pubspec = pubspec.replace(/^version:\s*.*$/m, `version: ${version}+${versionCode}`);
  fs.writeFileSync(PUBSPEC_PATH, pubspec, 'utf-8');
  log(`Updated pubspec.yaml`);

  // 2. update_service.dart
  if (fs.existsSync(UPDATE_SERVICE_PATH)) {
    let updateService = fs.readFileSync(UPDATE_SERVICE_PATH, 'utf-8');
    updateService = updateService.replace(/static const String currentVersion = '.*?';/, `static const String currentVersion = '${version}';`);
    updateService = updateService.replace(/static const int currentVersionCode = \d+;/, `static const int currentVersionCode = ${versionCode};`);
    fs.writeFileSync(UPDATE_SERVICE_PATH, updateService, 'utf-8');
    log(`Updated update_service.dart`);
  }

  // 3. Backend/server.js
  if (fs.existsSync(SERVER_JS_PATH)) {
    let serverJs = fs.readFileSync(SERVER_JS_PATH, 'utf-8');
    serverJs = serverJs.replace(/version:\s*'.*?',/g, `version: '${version}',`);
    serverJs = serverJs.replace(/versionCode:\s*\d+,/g, `versionCode: ${versionCode},`);
    fs.writeFileSync(SERVER_JS_PATH, serverJs, 'utf-8');
    log(`Updated Backend/server.js`);
  }
}

function buildApk() {
  log(`Running flutter build apk --release in driver_app... ⏳ (This may take ~2-4 minutes)`);
  execSync('flutter build apk --release', { cwd: DRIVER_APP_DIR, stdio: 'inherit' });

  if (!fs.existsSync(BUILT_APK_PATH)) {
    throw new Error(`Built APK not found at ${BUILT_APK_PATH}`);
  }

  const stat = fs.statSync(BUILT_APK_PATH);
  success(`APK built successfully: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);

  fs.copyFileSync(BUILT_APK_PATH, DEST_APK_PATH);
  success(`Copied APK to Frontend/downloads/RudrakshaDriver.apk`);
}

function githubRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function uploadAsset(uploadUrl, filePath) {
  return new Promise((resolve, reject) => {
    const cleanUrl = uploadUrl.replace(/\{.*?\}$/, '');
    const url = new URL(cleanUrl);
    url.searchParams.set('name', path.basename(filePath));

    const stat = fs.statSync(filePath);
    const readStream = fs.createReadStream(filePath);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'User-Agent': 'Rudraksha-Deploy-Bot',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size
      }
    };

    log(`Uploading ${(stat.size / 1024 / 1024).toFixed(1)} MB to GitHub Release...`);
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    readStream.pipe(req);
  });
}

async function createGitHubRelease(version, versionCode) {
  const tag = `v${version}`;
  const releaseName = `Rudraksha Driver App ${tag}`;
  const releaseBody = `## Rudraksha Driver App ${tag} (Build ${versionCode})
- Automated Release Deploy
- Persistent Background Foreground Service (Lock-Screen / Screen-Off Sirens)
- Heads-Up Notification with Instant Accept/Decline
- Vehicle-Category Matching (Auto, Mini Truck, Bike)
- Real-Time Fleet GPS Synchronization`;

  log(`Creating GitHub Release ${tag}...`);

  let createRes = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
    method: 'POST',
    headers: {
      'User-Agent': 'Rudraksha-Deploy-Bot',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    }
  }, JSON.stringify({
    tag_name: tag,
    target_commitish: 'main',
    name: releaseName,
    body: releaseBody,
    draft: false,
    prerelease: false
  }));

  let release = createRes.body;
  if (createRes.status === 422) {
    log(`Tag ${tag} already exists, fetching existing release...`);
    const listRes = await githubRequest({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      method: 'GET',
      headers: {
        'User-Agent': 'Rudraksha-Deploy-Bot',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json'
      }
    });
    release = listRes.body.find(r => r.tag_name === tag);
  }

  if (!release || !release.upload_url) {
    throw new Error(`Failed to create or retrieve release: ${JSON.stringify(release)}`);
  }

  // Delete existing RudrakshaDriver.apk if already present
  if (release.assets && release.assets.length > 0) {
    for (const asset of release.assets) {
      if (asset.name === 'RudrakshaDriver.apk') {
        log(`Replacing existing asset ${asset.id}...`);
        await githubRequest({
          hostname: 'api.github.com',
          path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/assets/${asset.id}`,
          method: 'DELETE',
          headers: {
            'User-Agent': 'Rudraksha-Deploy-Bot',
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json'
          }
        });
      }
    }
  }

  const uploadRes = await uploadAsset(release.upload_url, DEST_APK_PATH);
  if (uploadRes.status === 201) {
    success(`Uploaded ${DEST_APK_PATH} to release ${tag}`);
    log(`Asset Download URL: ${uploadRes.body.browser_download_url}`);
  } else {
    throw new Error(`Upload failed with status ${uploadRes.status}: ${JSON.stringify(uploadRes)}`);
  }
}

async function verifyReleaseRedirect(version) {
  log(`Verifying latest download redirect...`);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'github.com',
      path: `/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/RudrakshaDriver.apk`,
      method: 'HEAD'
    }, (res) => {
      const loc = res.headers.location || '';
      if (loc.includes(`v${version}`)) {
        success(`GitHub latest download points to v${version} ✅ (${loc})`);
      } else {
        log(`Redirect points to: ${loc}`);
      }
      resolve();
    });
    req.on('error', () => resolve());
    req.end();
  });
}

function commitAndPush(version, versionCode) {
  log(`Committing and pushing release changes...`);
  try {
    execSync('git add driver_app/ Backend/server.js Frontend/admin.html Frontend/admin.js Frontend/admin.css', { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync(`git commit -m "chore(release): bump driver app to v${version}+${versionCode}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('git push origin main', { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('git push personal main', { cwd: ROOT_DIR, stdio: 'inherit' });
    success(`Pushed release v${version}+${versionCode} to origin and personal remotes!`);
  } catch (e) {
    log(`Git push completed or nothing to commit: ${e.message}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log(' 🚀 Rudraksha Driver App Automated Deployment Pipeline ');
  console.log('======================================================\n');

  const { version: curVer, code: curCode } = parseCurrentVersion();
  log(`Current detected version: v${curVer}+${curCode}`);

  let targetVer = process.argv[2];
  let targetCode = process.argv[3] ? parseInt(process.argv[3], 10) : null;

  if (!targetVer) {
    const next = computeNextVersion(curVer, curCode);
    targetVer = next.nextVer;
    targetCode = next.nextCode;
  } else if (!targetCode) {
    targetCode = curCode + 1;
  }

  log(`Target Deployment Version: v${targetVer} (Build Code: ${targetCode})`);

  // Step 1: Version Sync
  syncVersionFiles(targetVer, targetCode);

  // Step 2: Build Flutter APK
  buildApk();

  // Step 3: GitHub Release & Upload Asset
  await createGitHubRelease(targetVer, targetCode);

  // Step 4: Verify Latest Redirect
  await verifyReleaseRedirect(targetVer);

  // Step 5: Git Commit & Push
  commitAndPush(targetVer, targetCode);

  console.log('\n======================================================');
  success(`Driver App v${targetVer} (Build ${targetCode}) Deployment COMPLETE! 🎉`);
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err);
  process.exit(1);
});
