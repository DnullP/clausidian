/**
 * quicknote — capture from macOS clipboard (pbpaste) as an idea note
 */
import { execSync } from 'child_process';
import { platform } from 'os';
import { capture } from './capture.mjs';

function getClipboard() {
  const os = platform();
  try {
    if (os === 'darwin') {
      return execSync('pbpaste', { encoding: 'utf8' }).trim();
    } else if (os === 'linux') {
      return execSync('xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null', {
        encoding: 'utf8', shell: true,
      }).trim();
    } else if (os === 'win32') {
      return execSync('powershell -command "Get-Clipboard"', { encoding: 'utf8' }).trim();
    }
  } catch {
    return '';
  }
  return '';
}

export function quicknote(vaultRoot, { prefix = '' } = {}) {
  const clipboard = getClipboard();
  if (!clipboard) {
    throw new Error('Clipboard is empty. Copy some text first.');
  }

  const text = prefix ? `${prefix}: ${clipboard}` : clipboard;
  const result = capture(vaultRoot, text);

  console.log(`Quicknote from clipboard → ${result.file}`);
  return { ...result, source: 'clipboard' };
}
