/**
 * events — view and query vault event history (v3.5 Event System)
 */
import { Vault } from '../vault.mjs';

export function eventsList(vaultRoot, { count = 20 } = {}) {
  const vault = new Vault(vaultRoot);
  const recent = vault.eventHistory.getRecent(count);

  return {
    status: 'success',
    events: recent.map(e => ({
      ts: e.ts,
      event: e.event,
      payload: e.payload,
      success: e.success,
      errors: e.errors.length > 0 ? e.errors : undefined,
    })),
    count: recent.length,
  };
}

export function eventsQuery(vaultRoot, { eventType, startTime, endTime } = {}) {
  const vault = new Vault(vaultRoot);
  let results = [];

  // Filter by event type if provided
  if (eventType) {
    results = vault.eventHistory.queryByEvent(eventType);
  } else {
    results = vault.eventHistory.cache;
  }

  // Filter by time range if provided
  if (startTime || endTime) {
    const start = startTime ? new Date(startTime).getTime() : 0;
    const end = endTime ? new Date(endTime).getTime() : Date.now();

    results = results.filter(e => {
      const ts = new Date(e.ts).getTime();
      return ts >= start && ts <= end;
    });
  }

  return {
    status: 'success',
    query: { eventType, startTime, endTime },
    results: results.map(e => ({
      ts: e.ts,
      event: e.event,
      payload: e.payload,
      success: e.success,
    })),
    count: results.length,
  };
}

export function eventsStats(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const stats = vault.eventHistory.getStats();

  return {
    status: 'success',
    stats: {
      totalEvents: stats.totalEvents,
      eventTypes: stats.byEvent,
      vaults: stats.byVault,
      oldestEvent: stats.oldestEvent,
      newestEvent: stats.newestEvent,
    },
  };
}
