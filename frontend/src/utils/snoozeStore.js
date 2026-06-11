// ── Persistent snooze store ──
// Snoozed items survive reloads, live in the Snoozed view with timestamps,
// and automatically return to the active queues when their time is up.

const KEY = 'corey-snoozed-v1';
const listeners = new Set();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch { return {}; }
}

function write(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {}
  for (const fn of listeners) { try { fn(); } catch {} }
}

// Drop entries whose return time has passed — they're active again
function prune(map) {
  const now = Date.now();
  let changed = false;
  for (const [k, v] of Object.entries(map)) {
    if (!v.returnsAt || v.returnsAt <= now) { delete map[k]; changed = true; }
  }
  return changed;
}

export function getSnoozedMap() {
  const map = read();
  if (prune(map)) write(map);
  return map;
}

export function isSnoozed(key) {
  if (!key) return false;
  return !!getSnoozedMap()[key];
}

// meta: { channel, title, from } — what the Snoozed view displays
export function snoozeItem(key, meta, durationMs) {
  if (!key) return;
  const map = getSnoozedMap();
  map[key] = {
    key,
    ...meta,
    snoozedAt: Date.now(),
    returnsAt: Date.now() + durationMs,
  };
  write(map);
}

export function wakeItem(key) {
  const map = getSnoozedMap();
  if (map[key]) {
    delete map[key];
    write(map);
  }
}

export function snoozedList() {
  return Object.values(getSnoozedMap()).sort((a, b) => a.returnsAt - b.returnsAt);
}

// Subscribe to changes (same-tab). Returns unsubscribe.
export function subscribeSnooze(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Stable identity for queue items across reloads
export function snoozeKeyFor(item) {
  if (!item) return null;
  if (item.channel === 'email') return `email:${item.threadId || item.subject || item.text}`;
  if (item.channel === 'rc') return `rc:${item.from}`;
  if (item.channel === 'qa') return `qa:${item.qaId ?? item.id}`;
  return `${item.channel}:${item.from || ''}:${item.subject || item.text || ''}`;
}

// One global ticker so expired snoozes wake up without a reload
setInterval(() => {
  const map = read();
  if (prune(map)) write(map);
}, 30 * 1000);
