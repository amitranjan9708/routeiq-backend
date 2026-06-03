#!/usr/bin/env node
/**
 * Setup mcp-skyscanner for RouteIQ (educational / experimental).
 * https://github.com/shadyvb/mcp-skyscanner
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'vendor/mcp-skyscanner');
const skyscannerDir = path.join(vendorDir, 'vendor/skyscanner');
const skyscannerLib = path.join(skyscannerDir, 'skyscanner', '__init__.py');
const exportScript = path.join(vendorDir, 'routeiq_export.py');
const venvDir = path.join(vendorDir, '.venv');
const venvPython =
  process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');
const repo = 'https://github.com/shadyvb/mcp-skyscanner.git';
const skyRepo = 'https://github.com/irrisolto/skyscanner.git';

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function hasSkyscannerLib() {
  return fs.existsSync(skyscannerLib);
}

function ensureSkyscannerLib() {
  if (hasSkyscannerLib()) {
    console.log('Skyscanner API library OK:', skyscannerDir);
    return;
  }

  if (fs.existsSync(skyscannerDir)) {
    console.log('Removing incomplete vendor/skyscanner...');
    fs.rmSync(skyscannerDir, { recursive: true, force: true });
  }

  console.log('Cloning skyscanner API library...');
  fs.mkdirSync(path.join(vendorDir, 'vendor'), { recursive: true });
  run(`git clone --depth 1 ${skyRepo} "${skyscannerDir}"`);
}

function resolvePython() {
  const fromEnv = process.env.SKYSCANNER_PYTHON || process.env.PYTHON_BIN;
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  const candidates = [
    'python3.13',
    'python3.12',
    'python3.11',
    'python3.10',
    '/opt/homebrew/bin/python3.13',
    '/opt/homebrew/bin/python3.12',
    '/opt/homebrew/bin/python3.11',
    'python3',
  ];

  for (const bin of candidates) {
    try {
      const r = spawnSync(bin, ['-c', 'import sys; assert sys.version_info >= (3, 10)'], {
        encoding: 'utf8',
      });
      if (r.status === 0) {
        const ver = spawnSync(bin, ['--version'], { encoding: 'utf8' });
        console.log('Using Python:', (ver.stdout || ver.stderr || '').trim(), `(${bin})`);
        return bin;
      }
    } catch {
      /* try next */
    }
  }

  console.error(
    'Need Python 3.10+ (Xcode python3.9 is too old). Install: brew install python@3.12'
  );
  console.error('Then set SKYSCANNER_PYTHON=/opt/homebrew/bin/python3.12 in backend/.env');
  process.exit(1);
}

if (!fs.existsSync(vendorDir)) {
  console.log('Cloning mcp-skyscanner...');
  fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
  run(`git clone --depth 1 ${repo} "${vendorDir}"`, { cwd: root });
}

ensureSkyscannerLib();

if (!fs.existsSync(exportScript)) {
  console.error('Missing routeiq_export.py in', vendorDir);
  process.exit(1);
}

const python = resolvePython();

if (!fs.existsSync(venvPython)) {
  console.log('Creating virtualenv at vendor/mcp-skyscanner/.venv ...');
  run(`${python} -m venv "${venvDir}"`);
}
const py = venvPython;

console.log('Installing RouteIQ Skyscanner deps into .venv ...');
run(`"${py}" -m pip install -U pip`, { cwd: vendorDir });
run(`"${py}" -m pip install -r routeiq-requirements.txt`, { cwd: vendorDir });

console.log('Smoke test (PAT→BLR, may take up to 60s)...');
try {
  run(
    `"${py}" routeiq_export.py PAT BLR 2026-08-15 cheapest`,
    {
      cwd: vendorDir,
      env: {
        ...process.env,
        SKYSCANNER_CURRENCY: 'INR',
        SKYSCANNER_MARKET: 'IN',
        SKYSCANNER_LOCALE: 'en-IN',
      },
      timeout: 120000,
    }
  );
} catch {
  console.warn('Smoke test failed (rate limit / network?) — deps are installed; retry later.');
}

const envPath = path.join(root, 'backend/.env');
const lines = [
  `SKYSCANNER_MCP_VENDOR_DIR=${vendorDir}`,
  `SKYSCANNER_PYTHON=${py}`,
  'SKYSCANNER_CURRENCY=INR',
  'SKYSCANNER_MARKET=IN',
  'SKYSCANNER_LOCALE=en-IN',
  'FLIGHT_PROVIDER=both',
];
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
for (const line of lines) {
  const key = line.split('=')[0];
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(env)) env = env.replace(re, line);
  else env = env.trimEnd() + (env.endsWith('\n') || !env ? '' : '\n') + line + '\n';
}
fs.writeFileSync(envPath, env);

console.log('\nDone. Skyscanner vendor:', vendorDir);
console.log('Python for Skyscanner:', python);
console.log('FLIGHT_PROVIDER=both → Google + Kiwi + Skyscanner');
console.log('Restart backend: cd backend && npm run dev');
