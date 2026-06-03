#!/usr/bin/env node
/**
 * Clone flights-mcp-server (Google Flights via fast-flights) for RouteIQ.
 * https://github.com/smamidipaka6/flights-mcp-server
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'vendor/flights-mcp-server');
const exportScript = path.join(vendorDir, 'routeiq_export.py');
const repo = 'https://github.com/smamidipaka6/flights-mcp-server.git';

if (!fs.existsSync(vendorDir)) {
  console.log('Cloning flights-mcp-server...');
  fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
  execSync(`git clone --depth 1 ${repo} "${vendorDir}"`, { stdio: 'inherit', cwd: root });
}

const template = path.join(__dirname, 'flights-routeiq_export.py');
if (!fs.existsSync(exportScript) && fs.existsSync(template)) {
  fs.copyFileSync(template, exportScript);
  console.log('Installed routeiq_export.py');
}

console.log('Syncing Python deps (uv)...');
try {
  execSync('uv sync', { cwd: vendorDir, stdio: 'inherit' });
} catch {
  console.warn('uv sync failed — install uv: https://docs.astral.sh/uv/');
  process.exit(1);
}

if (!fs.existsSync(exportScript)) {
  console.error('Missing routeiq_export.py — ensure vendor/flights-mcp-server is complete');
  process.exit(1);
}

console.log('Smoke test PAT → BLR...');
execSync('uv run python routeiq_export.py PAT BLR 2026-08-02 cheapest', {
  cwd: vendorDir,
  stdio: 'inherit',
});

const envPath = path.join(root, 'backend/.env');
const envLine = `GOOGLE_FLIGHTS_VENDOR_DIR=${vendorDir}`;
const providerLine = 'FLIGHT_PROVIDER=both';
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

for (const [key, line] of [
  ['GOOGLE_FLIGHTS_VENDOR_DIR', envLine],
  ['FLIGHT_PROVIDER', providerLine],
]) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(env)) env = env.replace(re, line);
  else env = env.trimEnd() + (env.endsWith('\n') || !env ? '' : '\n') + line + '\n';
}
fs.writeFileSync(envPath, env);

console.log('\nDone. Google Flights vendor:', vendorDir);
console.log('Set FLIGHT_PROVIDER=both in backend/.env (Google + Kiwi)');
console.log('Restart backend: cd backend && npm run dev');
