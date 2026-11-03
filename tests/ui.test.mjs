// Tests for the desktop app's pure logic (app/mods/gaucho/logic.js).
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  duration, terminal, inbox, counts, badgeText, nextTarget, keyAction, move, pressGuard, landIndex, TABS, overlay,
} from "../app/mods/gaucho/logic.js";

const NOW = 10_000_000;
const min = (m) => m * 60000;
const agent = (id, status, ago, extra = {}) => ({ id, key: `local/${id}`, machine: "local", kind: "claude", status, since_ms: NOW - min(ago), ...extra });

test("duration matches the agents sidebar", () => {
  assert.equal(duration(30000), "<1m");
  assert.equal(duration(min(12)), "12m");
  assert.equal(duration(min(150)), "2h");
  assert.equal(duration(min(60 * 50)), "2d");
});

test("terminal address is bare for local, machine/id for remote", () => {
  assert.equal(terminal({ machine: "local", id: "t1" }), "t1");
  assert.equal(terminal({ machine: "box", id: "t1" }), "box/t1");
});

test("inbox orders blocked, done, stuck; longest wait first in each", () => {
  const fleet = [
    agent("d1", "done", 2),
    agent("w1", "working", 40, { stuck: "same screen 20m", tracked: { quiet_since: NOW - min(25) } }),
    agent("b1", "blocked", 3),
    agent("d2", "done", 9),
    agent("b2", "blocked", 15),
    agent("w2", "working", 5),
    agent("i1", "idle", 50),
    agent("w3", "working", 60, { stuck: "loop", tracked: { quiet_since: NOW - min(30) } }),
  ];
  const rows = inbox(fleet, NOW);
  assert.deepEqual(rows.map((r) => r.id), ["b2", "b1", "d2", "d1", "w3", "w1"]);
  assert.deepEqual(rows.map((r) => r.group), ["blocked", "blocked", "done", "done", "stuck", "stuck"]);
  assert.deepEqual(rows.map((r) => r.label), ["waiting 15m", "waiting 3m", "done 9m ago", "done 2m ago", "quiet 30m", "quiet 25m"]);
});

test("stuck without quiet_since falls back to since_ms", () => {
  const [row] = inbox([agent("w", "working", 7, { stuck: "x" })], NOW);
  assert.equal(row.label, "quiet 7m");
});

test("counts and badge text", () => {
  const fleet = [agent("b", "blocked", 1), agent("b2", "blocked", 1), agent("d", "done", 1), agent("w", "working", 1, { stuck: "x" }), agent("w2", "working", 1)];
  assert.deepEqual(counts(fleet), { blocked: 2, done: 1, stuck: 1 });
  assert.equal(badgeText(counts(fleet)), "2 blocked · 1 done · 1 stuck");
  assert.equal(badgeText({ blocked: 0, done: 3, stuck: 0 }), "3 done");
  assert.equal(badgeText({ blocked: 0, done: 0, stuck: 0 }), "Gaucho: all clear");
});

test("next target is the longest-waiting agent that needs you", () => {
  assert.equal(nextTarget([agent("d", "done", 30), agent("b", "blocked", 1, { machine: "box" })], NOW), "box/b");
  assert.equal(nextTarget([agent("w", "working", 1)], NOW), null);
});

test("key map", () => {
  assert.equal(TABS.join(","), "Inbox,Dispatch,Land,Stuck,Clean");
  assert.deepEqual(keyAction("1", "Land"), { tab: "Inbox" });
  assert.deepEqual(keyAction("5", "Inbox"), { tab: "Clean" });
  assert.equal(keyAction("6", "Inbox"), null);
  assert.equal(keyAction("down", "Inbox"), "down");
  assert.equal(keyAction("up", "Clean"), "up");
  assert.equal(keyAction("enter", "Inbox"), "enter");
  assert.equal(keyAction("escape", "Inbox"), "close");
  assert.equal(keyAction("l", "Inbox"), "land");
  assert.equal(keyAction("l", "Dispatch"), null);
  assert.equal(keyAction("o", "Land"), "opinion");
  assert.equal(keyAction("o", "Inbox"), null);
  assert.equal(keyAction("backspace", "Dispatch"), "back");
  assert.equal(keyAction("backspace", "Inbox"), null);
  // Typing into a Land feedback box keeps its letters and digits.
  assert.equal(keyAction("l", "Land", { typing: true }), null);
  assert.equal(keyAction("1", "Land", { typing: true }), null);
  assert.equal(keyAction("escape", "Land", { typing: true }), "blur");
});

test("move clamps within the list", () => {
  assert.equal(move(0, -1, 3), 0);
  assert.equal(move(0, 1, 3), 1);
  assert.equal(move(2, 1, 3), 2);
  assert.equal(move(0, 1, 0), 0);
});

test("destructive actions need a second press within 3s", () => {
  let s = pressGuard(null, "x", 0);
  assert.deepEqual(s, { fire: false, armed: { id: "x", at: 0 } });
  s = pressGuard(s.armed, "x", 2999);
  assert.deepEqual(s, { fire: true, armed: null });
  s = pressGuard({ id: "x", at: 0 }, "x", 3000);
  assert.equal(s.fire, false);
  s = pressGuard({ id: "x", at: 0 }, "y", 10);
  assert.deepEqual(s, { fire: false, armed: { id: "y", at: 10 } });
});

test("landIndex finds the card for an agent", () => {
  const land = [{ machine: "local", agent: "a" }, { machine: "box", agent: "b" }];
  assert.equal(landIndex(land, { machine: "box", id: "b" }), 1);
  assert.equal(landIndex(land, { machine: "local", id: "b" }), -1);
});

test("overlay: live status wins, engine keeps wait times and stuck", () => {
  const fleet = [
    agent("b", "blocked", 10),
    agent("d", "done", 4),
    agent("w", "working", 30, { stuck: "loop", tracked: { quiet_since: NOW - min(20) } }),
    agent("r", "blocked", 2, { machine: "box" }),
    agent("gone", "done", 1),
  ];
  const live = [
    { address: "b", status: "blocked", app: "claude-code" },
    { address: "d", status: "idle", app: "claude-code" }, // looked at: done turns idle
    { address: "w", status: "working", app: "claude-code" },
    { address: "box/r", status: "working", app: "codex" }, // unblocked since the last engine read
    { address: "new", status: "blocked", app: "pi" }, // not in the engine fleet yet
  ];
  const changed = {};
  const out = overlay(fleet, live, changed, NOW);
  const by = Object.fromEntries(out.map((a) => [terminal(a), a]));
  assert.equal(by.b.since_ms, NOW - min(10));
  assert.equal(by.d.status, "idle");
  assert.equal(by.w.stuck, "loop");
  assert.equal(by["box/r"].status, "working");
  assert.equal(by["box/r"].stuck, undefined);
  assert.deepEqual([by.new.machine, by.new.id, by.new.kind, by.new.since_ms], ["local", "new", "pi", NOW]);
  assert.equal(by.gone.status, "done"); // absent from agents(): engine data stays
  assert.deepEqual(inbox(out, NOW).map((r) => r.id), ["b", "new", "gone", "w"]);
  // A changed status keeps its first-seen stamp on later renders.
  const later = overlay(fleet, live, changed, NOW + min(5));
  assert.equal(later.find((a) => a.id === "new").since_ms, NOW);
  // Once the engine catches up, its since_ms is used again.
  const caught = overlay([agent("new", "blocked", 1)], live, changed, NOW + min(5));
  assert.equal(caught[0].since_ms, NOW - min(1));
});

test("overlay without live data returns the engine fleet", () => {
  const fleet = [agent("b", "blocked", 1)];
  assert.deepEqual(overlay(fleet, null, {}, NOW), fleet);
});

test("the badge ships the same logic.js as the popup", async () => {
  const { readFile } = await import("node:fs/promises");
  const a = await readFile(new URL("../app/mods/gaucho/logic.js", import.meta.url), "utf8");
  const b = await readFile(new URL("../app/mods/gaucho-badge/logic.js", import.meta.url), "utf8");
  assert.equal(b, a);
});
