#!/usr/bin/env node
/**
 * Clone and build indian-railways-mcp locally (free, no API key).
 * https://github.com/rajprem4214/indian-railways-mcp
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'vendor/indian-railways-mcp');
const built = path.join(vendorDir, 'build/index.js');
const repo = 'https://github.com/rajprem4214/indian-railways-mcp.git';

if (!fs.existsSync(vendorDir)) {
  console.log('Cloning indian-railways-mcp...');
  fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
  execSync(`git clone --depth 1 ${repo} "${vendorDir}"`, { stdio: 'inherit', cwd: root });
}

console.log('Installing dependencies...');
execSync('npm install', { cwd: vendorDir, stdio: 'inherit' });

console.log('Building...');
execSync('npm run build', { cwd: vendorDir, stdio: 'inherit' });

if (!fs.existsSync(built)) {
  console.error('Build failed: missing', built);
  process.exit(1);
}

const envPath = path.join(root, '.env');
const envLine = `INDIAN_RAILWAYS_MCP_SERVER=${built}`;
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

if (/^INDIAN_RAILWAYS_MCP_SERVER=/m.test(env)) {
  env = env.replace(/^INDIAN_RAILWAYS_MCP_SERVER=.*$/m, envLine);
} else {
  env = env.trimEnd() + (env.endsWith('\n') || !env ? '' : '\n') + envLine + '\n';
}
fs.writeFileSync(envPath, env);

console.log('\nDone. MCP server:', built);
console.log('Set in .env:', envLine);
console.log('\nStart API: npm run dev');
