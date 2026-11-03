// Gaucho badge: "2 blocked · 1 done · 1 stuck" in a thin bottom bar.
// Click opens the Gaucho popup; alt-n (gaucho-badge.next) focuses the agent that has waited longest.
// While docked it runs the engine's tick (delivery, stuck detection, the queue) and writes a
// heartbeat to shared("gaucho.badge") so the popup does not tick as well.
// logic.js is a copy of ../gaucho/logic.js (install.sh copies it; tests cover the original).

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, appHome, nextCommand, notify, run, setShared, theme } from "herdr";
import { counts, badgeText, nextTarget } from "./logic.js";

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
    this.refresh(cx);
    cx.timer.every(5000, (cx) => this.refresh(cx));
    this.tick(cx);
    cx.timer.every(20000, (cx) => this.tick(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c !== "next") continue;
        const target = nextTarget(this.fleet, Date.now());
        if (target) run("agent.focus", { terminal: target });
        else notify({ title: "Gaucho", body: "No agent needs you", level: "info" });
        cx.notify();
      }
    });
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      try {
        this.fleet = JSON.parse((await gaucho("fleet")) || "[]");
        this.error = null;
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      cx.notify();
    });
  }

  tick(cx) {
    setShared("gaucho.badge", Date.now());
    cx.spawn(async () => { await gaucho("job", "tick").catch(() => {}); });
  }

  render() {
    const t = theme();
    const c = counts(this.fleet);
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
