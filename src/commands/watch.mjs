/**
 * watch — auto-rebuild indices on file changes + spawn hook events
 * Includes time-aware auto-triggers: daily-backfill on new day, weekly-review on Sunday
 */
import { watch as fsWatch, existsSync } from 'fs';
import { spawn } from 'child_process';
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr, getWeekDates } from '../dates.mjs';

export function watch(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);

  let debounce = null;
  const changedFiles = new Map();
  const fileState = new Map(); // Track file existence

  // Time-aware state
  let lastDailyBackfillDate = null;
  let lastWeeklyReviewDate = null;
  let lastSyncCount = { tags: 0, notes: 0, relationships: 0 };

  // Initialize file state
  const initialNotes = vault.scanNotes();
  for (const note of initialNotes) {
    fileState.set(note.file, { exists: true, timestamp: Date.now() });
  }

  // Helper: spawn a hook subprocess for time-aware events
  const spawnHook = (hookEvent, options = {}) => {
    const payload = {
      event: hookEvent,
      timestamp: new Date().toISOString(),
      ...options
    };

    const proc = spawn(process.execPath, [process.argv[1], 'hook', hookEvent], {
      cwd: vaultRoot,
      stdio: ['pipe', 'pipe', 'inherit']
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();

    proc.stdout.on('data', (data) => {
      try {
        const result = JSON.parse(data.toString());
        if (result.status) {
          console.log(`  ✓ ${hookEvent}: ${result.status}`);
        }
      } catch {
        // Ignore non-JSON stdout
      }
    });

    proc.on('error', (err) => {
      console.error(`[hook spawn error] ${err.message}`);
    });
  };

  // Time-aware helper: check and trigger daily-backfill + weekly-review
  const checkAndTriggerTimeAwareHooks = () => {
    const today = todayStr();

    // Daily-backfill: trigger if date changed
    if (today !== lastDailyBackfillDate) {
      lastDailyBackfillDate = today;
      spawnHook('daily-backfill', { date: today });
    }

    // Weekly-review: trigger on Sunday if not yet done this week
    const dates = getWeekDates(today);
    const isSunday = new Date(today + 'T12:00:00Z').getDay() === 0;
    const weekStart = dates[0];

    if (isSunday && weekStart !== lastWeeklyReviewDate) {
      lastWeeklyReviewDate = weekStart;
      spawnHook('review');
    }
  };

  // Helper: spawn hook events for file changes (note-created, note-updated, note-deleted)
  const spawnHookEvents = (changedFileSet) => {
    if (changedFileSet.size === 0) return;

    for (const [noteName, eventType] of changedFileSet) {
      const eventMap = {
        created: 'note-created',
        updated: 'note-updated',
        deleted: 'note-deleted'
      };
      const hookEvent = eventMap[eventType];

      const payload = {
        event: hookEvent,
        note: noteName,
        timestamp: new Date().toISOString(),
        changes: { [eventType]: true }
      };

      // Spawn hook subprocess with JSON payload on stdin
      const proc = spawn(process.execPath, [process.argv[1], 'hook', hookEvent], {
        cwd: vaultRoot,
        stdio: ['pipe', 'pipe', 'inherit']
      });

      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();

      proc.stdout.on('data', (data) => {
        try {
          const result = JSON.parse(data.toString());
          if (result.suggestions) {
            console.log(`  → ${noteName}: ${result.suggestions.length} link suggestions`);
          }
        } catch {
          // Ignore non-JSON stdout
        }
      });

      proc.on('error', (err) => {
        console.error(`[hook spawn error] ${err.message}`);
      });
    }
  };

  const rebuild = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      try {
        const result = idx.sync();
        const ts = new Date().toLocaleTimeString('en-US', { hour12: false });

        // Calculate delta from last sync
        const tagDelta = result.tags - lastSyncCount.tags;
        const noteDelta = result.notes - lastSyncCount.notes;
        const linkDelta = result.relationships - lastSyncCount.relationships;

        // Display current state with delta if changed
        let message = `[${ts}] Synced: ${result.tags} tags, ${result.notes} notes, ${result.relationships} links`;
        if (tagDelta !== 0 || noteDelta !== 0 || linkDelta !== 0) {
          const deltaStr = [
            tagDelta !== 0 ? `+${tagDelta} tags` : null,
            noteDelta !== 0 ? `+${noteDelta} notes` : null,
            linkDelta !== 0 ? `+${linkDelta} links` : null
          ].filter(Boolean).join(', ');
          message += ` (${deltaStr})`;
        }
        console.log(message);
        lastSyncCount = { tags: result.tags, notes: result.notes, relationships: result.relationships };

        // Spawn hook events for changed files
        spawnHookEvents(changedFiles);
        changedFiles.clear();

        // Time-aware triggers: daily-backfill on new day, weekly-review on Sunday
        checkAndTriggerTimeAwareHooks();
      } catch (err) {
        console.error(`[sync error] ${err.message}`);
      }
    }, 500);
  };

  // Single recursive watcher on vault root (macOS FSEvents supports recursive natively)
  const watchDirs = vault.dirs;
  const watchers = [];

  try {
    const w = fsWatch(vault.root, { recursive: true }, (event, filename) => {
      if (!filename) return;
      if (!filename.endsWith('.md')) return;
      if (filename.startsWith('.git/') || filename.startsWith('node_modules/') || filename.startsWith('.obsidian/')) return;
      const base = filename.split('/').pop();
      if (base.startsWith('_')) return;

      // Track file change for event spawning
      const noteName = base.replace(/\.md$/, '');
      const fullPath = vault.path(filename);
      const exists = existsSync(fullPath);

      if (exists) {
        // Created or updated
        if (!fileState.has(noteName)) {
          changedFiles.set(noteName, 'created');
        } else {
          changedFiles.set(noteName, 'updated');
        }
        fileState.set(noteName, { exists: true, timestamp: Date.now() });
      } else {
        // Deleted
        changedFiles.set(noteName, 'deleted');
        fileState.delete(noteName);
      }

      rebuild();
    });
    watchers.push(w);
  } catch {
    // Fallback: watch each content directory individually (non-recursive)
    for (const dir of watchDirs) {
      const dirPath = vault.path(dir);
      try {
        const w = fsWatch(dirPath, { recursive: false }, (event, filename) => {
          if (filename && filename.endsWith('.md') && !filename.startsWith('_')) {
            const noteName = filename.replace(/\.md$/, '');
            const fullPath = vault.path(`${dir}/${filename}`);
            const exists = existsSync(fullPath);
            if (exists) {
              changedFiles.set(noteName, fileState.has(noteName) ? 'updated' : 'created');
              fileState.set(noteName, { exists: true, timestamp: Date.now() });
            } else {
              changedFiles.set(noteName, 'deleted');
              fileState.delete(noteName);
            }
            rebuild();
          }
        });
        watchers.push(w);
      } catch {
        // Directory may not exist yet
      }
    }
  }

  // Initial sync
  const result = idx.sync();
  console.log(`clausidian watching ${vault.root}`);
  console.log(`Initial: ${result.tags} tags, ${result.notes} notes, ${result.relationships} links`);
  console.log('Press Ctrl+C to stop.\n');

  // Keep process alive
  process.on('SIGINT', () => {
    for (const w of watchers) w.close();
    console.log('\nStopped watching.');
    process.exit(0);
  });

  return { status: 'watching', dirs: watchDirs.length };
}
