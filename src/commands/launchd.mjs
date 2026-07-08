/**
 * launchd — install/uninstall macOS LaunchAgents for automated vault maintenance
 *
 * NOTE: Deprecated in favor of com.dex.obsidian-* system which uses scripts in
 * /Users/dex/YD 2026/scripts/obsidian-*.sh (daily/weekly/monthly)
 *
 * Legacy agents (preserved for reference):
 *   - com.clausidian.daily-backfill  (daily at 23:30)
 *   - com.clausidian.weekly-review   (Sunday at 20:00)
 */
import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { execSync } from 'child_process';
import { resolve } from 'path';

const AGENTS = {
  'com.clausidian.daily-backfill': {
    label: 'com.clausidian.daily-backfill',
    description: 'Daily journal backfill from git history',
    hour: 23,
    minute: 30,
    weekday: null, // every day
    args: (vault, scanRoot) => ['hook', 'daily-backfill', '--vault', vault, '--scan-root', scanRoot],
  },
  'com.clausidian.weekly-review': {
    label: 'com.clausidian.weekly-review',
    description: 'Weekly review generation',
    hour: 20,
    minute: 0,
    weekday: 7, // Sunday
    args: (vault) => ['review', '--vault', vault],
  },
};

function agentDir() {
  return join(homedir(), 'Library', 'LaunchAgents');
}

function plistPath(label) {
  return join(agentDir(), `${label}.plist`);
}

function whichBin() {
  try {
    return execSync('which clausidian', { encoding: 'utf8' }).trim();
  } catch {
    return 'clausidian';
  }
}

function buildPlist(agent, vaultPath, scanRoot) {
  const bin = whichBin();
  const args = agent.args(vaultPath, scanRoot || join(vaultPath, '..'));
  const programArgs = [bin, ...args].map(a => `    <string>${a}</string>`).join('\n');

  let calendarInterval = `    <dict>
      <key>Hour</key>
      <integer>${agent.hour}</integer>
      <key>Minute</key>
      <integer>${agent.minute}</integer>`;
  if (agent.weekday) {
    calendarInterval += `
      <key>Weekday</key>
      <integer>${agent.weekday}</integer>`;
  }
  calendarInterval += `
    </dict>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${agent.label}</string>
  <key>ProgramArguments</key>
  <array>
${programArgs}
  </array>
  <key>StartCalendarInterval</key>
${calendarInterval}
  <key>StandardOutPath</key>
  <string>${join(homedir(), '.clausidian', 'launchd.log')}</string>
  <key>StandardErrorPath</key>
  <string>${join(homedir(), '.clausidian', 'launchd.err')}</string>
  <key>RunAtLoad</key>
  <false/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>OA_VAULT</key>
    <string>${vaultPath}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
`;
}

export function launchdInstall(vaultPath, { scanRoot } = {}) {
  if (platform() !== 'darwin') {
    throw new Error('LaunchAgent is macOS-only. Use cron on Linux.');
  }

  const vault = resolve(vaultPath || process.env.OA_VAULT || '.');
  const dir = agentDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Create log directory
  const logDir = join(homedir(), '.clausidian');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  const installed = [];
  for (const [label, agent] of Object.entries(AGENTS)) {
    const path = plistPath(label);
    const plist = buildPlist(agent, vault, scanRoot);
    writeFileSync(path, plist);

    // Unload first (ignore errors if not loaded)
    try { execSync(`launchctl unload "${path}" 2>/dev/null`); } catch {}
    execSync(`launchctl load "${path}"`);
    installed.push({ label, description: agent.description, path });
    console.log(`  ✓ ${label} — ${agent.description}`);
  }

  console.log(`\nInstalled ${installed.length} LaunchAgents.`);
  console.log(`Logs: ${logDir}/launchd.log`);
  return { status: 'installed', agents: installed };
}

export function launchdUninstall() {
  if (platform() !== 'darwin') {
    throw new Error('LaunchAgent is macOS-only.');
  }

  const removed = [];
  for (const label of Object.keys(AGENTS)) {
    const path = plistPath(label);
    if (existsSync(path)) {
      try { execSync(`launchctl unload "${path}" 2>/dev/null`); } catch {}
      unlinkSync(path);
      removed.push(label);
      console.log(`  ✗ Removed ${label}`);
    }
  }

  if (!removed.length) {
    console.log('No LaunchAgents found to remove.');
  }
  return { status: 'uninstalled', removed };
}

export function launchdStatus() {
  if (platform() !== 'darwin') {
    throw new Error('LaunchAgent is macOS-only.');
  }

  const agents = [];
  for (const [label, agent] of Object.entries(AGENTS)) {
    const path = plistPath(label);
    const installed = existsSync(path);
    let loaded = false;
    if (installed) {
      try {
        const out = execSync(`launchctl list 2>/dev/null | grep "${label}"`, {
          encoding: 'utf8', shell: true,
        });
        loaded = out.trim().length > 0;
      } catch {}
    }
    agents.push({
      label,
      description: agent.description,
      schedule: agent.weekday
        ? `Sunday ${agent.hour}:${String(agent.minute).padStart(2, '0')}`
        : `Daily ${agent.hour}:${String(agent.minute).padStart(2, '0')}`,
      installed,
      loaded,
    });
    const icon = installed ? (loaded ? '●' : '○') : '✗';
    console.log(`  ${icon} ${label} — ${agent.description} (${agents.at(-1).schedule})`);
  }

  // Show log tail if exists
  const logPath = join(homedir(), '.clausidian', 'launchd.log');
  if (existsSync(logPath)) {
    try {
      const log = readFileSync(logPath, 'utf8');
      const lines = log.trim().split('\n').slice(-5);
      if (lines.length && lines[0]) {
        console.log(`\nRecent logs:`);
        for (const line of lines) console.log(`  ${line}`);
      }
    } catch {}
  }

  return { status: 'ok', agents };
}

// ── Router for registry ──
export function launchd(vaultRoot, cmd, flags) {
  if (cmd === 'install') {
    return launchdInstall(vaultRoot, flags);
  } else if (cmd === 'uninstall') {
    return launchdUninstall();
  } else if (cmd === 'status') {
    return launchdStatus();
  }
  throw new Error(`Unknown launchd command: ${cmd}\nAvailable: install, uninstall, status`);
}
