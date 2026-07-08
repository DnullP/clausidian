/**
 * Dual notification: macOS Notification Center + Telegram Bot
 * Gracefully degrades if either channel unavailable
 */
import { execSync } from 'child_process';
import { platform } from 'os';

function notifyMac(title, message, { sound = 'default' } = {}) {
  if (platform() !== 'darwin') return;
  try {
    const t = title.replace(/"/g, '\\"');
    const m = message.replace(/"/g, '\\"');
    const soundClause = sound ? ` sound name "${sound}"` : '';
    execSync(`osascript -e 'display notification "${m}" with title "${t}"${soundClause}'`);
  } catch {
    // Silently ignore — notifications are best-effort
  }
}

async function notifyTelegram(title, message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  try {
    const fullMessage = `<b>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>\n\n${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: fullMessage,
        parse_mode: 'HTML',
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error(`[Telegram notify error] ${err}`);
    }
  } catch (err) {
    // Silently ignore — Telegram notifications are best-effort
  }
}

export function notify(title, message, options = {}) {
  // Try macOS notification (synchronous)
  notifyMac(title, message, options);

  // Try Telegram notification (asynchronous, non-blocking)
  notifyTelegram(title, message).catch(() => {});
}
