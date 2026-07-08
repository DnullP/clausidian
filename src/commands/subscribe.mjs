/**
 * subscribe — subscribe to vault events (v3.5 Event System)
 * Streams events matching a pattern
 */
import { Vault } from '../vault.mjs';

export async function subscribe(vaultRoot, pattern, { count = 100 } = {}) {
  const vault = new Vault(vaultRoot);
  const results = [];

  // Simple implementation: collect matching events from history
  // (Real implementation would use event streaming)
  const allEvents = vault.eventHistory.queryByEvent(pattern);
  const events = allEvents.slice(-count);

  return {
    status: 'success',
    subscription: {
      pattern,
      eventCount: events.length,
      events: events.map(e => ({
        ts: e.ts,
        event: e.event,
        payload: e.payload,
      })),
    },
  };
}
