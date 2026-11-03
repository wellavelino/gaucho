// Pure logic for the Gaucho popup and badge: no herdr imports, so node can test it
// (tests/ui.test.mjs). The badge mod ships a copy of this file.

export const TABS = ["Inbox", "Dispatch", "Land", "Stuck", "Clean"];
export const GUARD_MS = 3000;

// Same rounding as the agents sidebar.
export function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// The address agent.focus takes: bare id for local agents, machine/id otherwise.
export function terminal(a) {
  return !a.machine || a.machine === "local" ? a.id : `${a.machine}/${a.id}`;
}

function groupOf(a) {
  if (a.status === "blocked") return "blocked";
  if (a.status === "done") return "done";
  if (a.status === "working" && a.stuck) return "stuck";
  return null;
}

const ORDER = { blocked: 0, done: 1, stuck: 2 };
const LABEL = { blocked: (d) => `waiting ${d}`, done: (d) => `done ${d} ago`, stuck: (d) => `quiet ${d}` };

// Agents that need you: blocked, then done, then stuck; longest wait first in each group.
export function inbox(fleet, now) {
  const rows = [];
  for (const a of fleet || []) {
    const group = groupOf(a);
    if (!group) continue;
    const from = group === "stuck" ? (a.tracked?.quiet_since ?? a.since_ms) : a.since_ms;
    const wait_ms = Math.max(0, now - (from ?? now));
    rows.push({ ...a, group, wait_ms, label: LABEL[group](duration(wait_ms)) });
  }
  return rows.sort((x, y) => ORDER[x.group] - ORDER[y.group] || y.wait_ms - x.wait_ms);
}

export function counts(fleet) {
  const c = { blocked: 0, done: 0, stuck: 0 };
  for (const a of fleet || []) {
    const g = groupOf(a);
    if (g) c[g]++;
  }
  return c;
}

export function badgeText(c) {
  const parts = ["blocked", "done", "stuck"].filter((k) => c[k] > 0).map((k) => `${c[k]} ${k}`);
  return parts.length ? parts.join(" · ") : "Gaucho: all clear";
}

export function nextTarget(fleet, now) {
  const [top] = inbox(fleet, now);
  return top ? terminal(top) : null;
}

// Popup key map. `typing` is true while a text box has focus: then only
// esc acts (it leaves the box), so letters and digits reach the box.
export function keyAction(key, tab, { typing = false } = {}) {
  if (key === "escape") return typing ? "blur" : "close";
  if (typing) return null;
  if (/^[1-9]$/.test(key)) {
    const t = TABS[Number(key) - 1];
    return t ? { tab: t } : null;
  }
  if (key === "up" || key === "down" || key === "enter") return key;
  if (key === "l" && tab === "Inbox") return "land";
  if (key === "o" && tab === "Land") return "opinion";
  if (key === "backspace" && tab === "Dispatch") return "back";
  return null;
}

export function move(index, delta, length) {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, index + delta));
}

// Two presses on the same id within GUARD_MS fire; anything else (re)arms.
export function pressGuard(armed, id, now) {
  if (armed && armed.id === id && now - armed.at < GUARD_MS) return { fire: true, armed: null };
  return { fire: false, armed: { id, at: now } };
}

export function landIndex(land, a) {
  return (land || []).findIndex((x) => x.agent === a.id && (x.machine || "local") === (a.machine || "local"));
}
