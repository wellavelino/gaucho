// Gaucho badge: "2 blocked · 1 done · 1 stuck" in a thin bottom bar.
// Click opens the Gaucho popup; alt-n (gaucho-badge.next) focuses the agent that has waited longest.
// Status is live from Herdr's agents(); the engine fleet (wait times, stuck, runs) is read every
// 20s with the tick (delivery, stuck detection, the queue) and shared as shared("gaucho.fleet").
// The heartbeat in shared("gaucho.badge") tells the popup not to tick or read the fleet itself.
// logic.js is a copy of ../gaucho/logic.js (install.sh copies it; tests cover the original).

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, exec, appHome, nextCommand, notify, run, setShared, theme } from "herdr";
import { counts, badgeText, nextTarget, overlay } from "./logic.js";

const engine = () => `${appHome()}/mods/gaucho/core/gaucho`;

async function gaucho(...args) {
  const r = await exec("bash", [engine(), "--runtime", "hc", ...args]);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || "Gaucho failed").trim());
  return r.stdout;
}

export default class GauchoBadge extends View {
  init(_props, cx) {
    this.fleet = [];
    this.error = null;
    this.changed = {};
    this.tick(cx);
    cx.timer.every(20000, (cx) => this.tick(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c !== "next") continue;
        const target = nextTarget(this.now(), Date.now());
        if (target) run("agent.focus", { terminal: target });
        else notify({ title: "Gaucho", body: "No agent needs you", level: "info" });
        cx.notify();
      }
    });
  }

  // The engine fleet with live status on top.
  now() { return overlay(this.fleet, agents(), this.changed, Date.now()); }

  tick(cx) {
    setShared("gaucho.badge", Date.now());
    cx.spawn(async (cx) => {
      await gaucho("job", "tick").catch(() => {});
      try {
        this.fleet = JSON.parse((await gaucho("fleet")) || "[]");
        this.error = null;
        setShared("gaucho.fleet", { at: Date.now(), fleet: this.fleet });
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      cx.notify();
    });
  }

  render() {
    const t = theme();
    const c = counts(this.now());
    const dot = (color) => div().size(6).rounded(3).bg(color);
    const part = (key, color) => h_flex().gap(6).items_center().child(dot(color)).child(`${c[key]} ${key}`);
    const bar = h_flex().id("gaucho-badge").size_full().px(14).gap(14).items_center()
      .bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .on_click(() => run("mod.open", { name: "gaucho" }));
    if (this.error) return bar.child(div().text_color(t.ansi1).child(`Gaucho: ${this.error.split("\n")[0]}`));
    const shown = [["blocked", t.blocked], ["done", t.done], ["stuck", t.ansi1]].filter(([k]) => c[k] > 0);
    if (!shown.length) return bar.child(badgeText(c));
    return bar.children(shown.map(([k, color]) => part(k, color)));
  }
}
