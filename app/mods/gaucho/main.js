// Gaucho for the Herdr desktop app. A view over core/gaucho, the engine the
// terminal plugins use: every action runs the engine. One difference: the Inbox
// here also lists stuck agents and sorts by wait, which the plugin's inbox does not.
// Ordering, labels and the key map live in ./logic.js (tested by node, tests/ui.test.mjs).
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, appHome, closeOverlay, focused, notify, props, run, theme, shared } from "herdr";
import { TABS, GUARD_MS, inbox, terminal, keyAction, move, pressGuard, landIndex } from "./logic.js";

// The badge mod ticks while it is docked; the popup only ticks when that heartbeat is stale.
const BADGE_STALE_MS = 30000;

const engine = () => `${appHome()}/mods/gaucho/core/gaucho`;

async function gaucho(...args) {
  const r = await exec("bash", [engine(), "--runtime", "hc", ...args]);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || "Gaucho failed").trim());
  return r.stdout;
}

const json = async (...args) => JSON.parse((await gaucho(...args)) || "null");
const message = (e) => String(e?.message ?? e);
const basename = (path) => (path || "").replace(/\/+$/, "").split("/").pop() || path;

export default class Gaucho extends View {
  init(_props, cx) {
    this.tab = "Inbox";
    this.sel = 0; // Selected row in the current tab; the top Inbox row on open.
    this.fleet = [];
    this.queue = [];
    this.land = null;
    this.landWanted = null; // The agent `l` asked for, selected once the Land list arrives.
    this.clean = null;
    this.sources = [];
    this.source = null;
    this.issues = [];
    this.issue = null;
    this.machines = ["local"];
    this.armed = null; // { id, at }: the action waiting for a second press.
    this.error = null;
    this.typing = false;
    this.feedback = new Map(); // One feedback box per Land card.
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => { if (!this.typing) this.handle.focus(); });
    this.refresh(cx);
    cx.timer.every(5000, (cx) => this.refresh(cx));
    // Delivery, stuck detection and the queue. Nothing here runs while the app is closed.
    cx.timer.every(20000, (cx) => {
      if (Date.now() - Number(shared("gaucho.badge") || 0) < BADGE_STALE_MS) return;
      cx.spawn(async () => { await gaucho("job", "tick").catch(() => {}); });
    });
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      try {
        this.fleet = await json("fleet");
        this.queue = await json("queue", "list");
        for (const job of await json("jobs")) this.report(job);
        this.error = null;
      } catch (e) {
        this.error = message(e);
      }
      cx.notify();
    });
  }

  report(job) {
    if (job.command === "tick") return;
    notify({
      title: job.ok ? "Gaucho" : "Gaucho: that did not work",
      body: job.output.split("\n").slice(-3).join("\n"),
      level: job.ok ? "info" : "error",
    });
  }

  // Slow commands run as jobs because exec stops at 30 seconds.
  start(cx, ...args) {
    cx.spawn(async (cx) => {
      await gaucho("job", ...args).catch((e) => { this.error = message(e); });
      cx.notify();
    });
  }

  // Start a job, then close the popup. It reports when the popup next opens.
  startAndClose(cx, ...args) {
    cx.spawn(async (cx) => {
      try {
        await gaucho("job", ...args);
        closeOverlay(props().overlay);
      } catch (e) {
        this.error = message(e);
        cx.notify();
      }
    });
  }

  show(tab, cx) {
    this.tab = tab;
    this.sel = 0;
    this.armed = null;
    if (tab === "Land") this.load(cx, "land", () => json("land-list"));
    if (tab === "Clean") this.load(cx, "clean", () => json("clean-list"));
    if (tab === "Dispatch") this.loadDispatch(cx);
  }

  load(cx, key, read) {
    this[key] = null;
    cx.spawn(async (cx) => {
      try { this[key] = await read(); } catch (e) { this.error = message(e); this[key] = []; }
      if (key === "land" && this.landWanted) {
        this.sel = Math.max(0, landIndex(this.land, this.landWanted));
        this.landWanted = null;
      }
      cx.notify();
    });
  }

  folder() {
    return focused()?.cwd ?? null;
  }

  loadDispatch(cx) {
    const cwd = this.folder();
    this.source = null;
    this.issue = null;
    this.issues = [];
    cx.spawn(async (cx) => {
      try {
        this.machines = (await gaucho("machines")).split("\n").filter(Boolean);
        this.sources = [];
        if (!cwd) return;
        const r = await exec("bash", [engine(), "--runtime", "hc", "sources"], { cwd });
        this.sources = r.stdout.split("\n").filter(Boolean);
        if (this.sources.length === 1) await this.loadIssues(this.sources[0]);
      } catch (e) {
        this.error = message(e);
      }
      cx.notify();
    });
  }

  async loadIssues(source) {
    this.source = source;
    this.sel = 0;
    const r = await exec("bash", [engine(), "--runtime", "hc", "source", source, "list"], { cwd: this.folder() });
    this.issues = r.stdout.split("\n").filter(Boolean).map((line) => {
      const [id, text] = line.split("\t");
      return { id, text };
    });
  }

  // ---- What each tab lists, and what ↵ does on a row --------------------------------

  inboxRows() { return inbox(this.fleet, Date.now()); }
  stuckRows() { return this.inboxRows().filter((r) => r.group === "stuck"); }

  // Dispatch rows depend on how deep the breadcrumb is.
  dispatchRows() {
    if (!this.folder()) return [];
    if (this.issue) return this.machines;
    if (this.source) return this.issues;
    return this.sources;
  }

  rows() {
    return {
      Inbox: () => this.inboxRows(),
      Stuck: () => this.stuckRows(),
      Dispatch: () => this.dispatchRows(),
      Land: () => this.land || [],
      Clean: () => this.clean || [],
    }[this.tab]();
  }

  focusAgent(a) {
    run("agent.focus", { terminal: terminal(a) });
    closeOverlay(props().overlay);
  }

  enter(cx) {
    const item = this.rows()[this.sel];
    if (!item) return;
    if (this.tab === "Inbox" || this.tab === "Stuck") return this.focusAgent(item);
    if (this.tab === "Dispatch") return this.pick(item, cx);
    if (this.tab === "Land") return this.start(cx, "land-action", "open-pr", item.machine, item.cwd, item.agent);
    if (this.tab === "Clean" && item.removable) return this.press(`gaucho-c-${item.machine}:${item.path}`, cx, (cx) => this.remove(item, cx));
  }

  // Step one level into the Dispatch breadcrumb; at the machine level, start.
  pick(item, cx) {
    if (this.issue) return this.startAndClose(cx, "dispatch", this.source, this.issue.id, item, this.folder());
    if (this.source) { this.issue = item; this.sel = 0; return; }
    cx.spawn(async (cx) => {
      try { await this.loadIssues(item); } catch (e) { this.error = message(e); }
      cx.notify();
    });
  }

  back() {
    if (this.issue) this.issue = null;
    else if (this.source && this.sources.length > 1) { this.source = null; this.issues = []; }
    this.sel = 0;
  }

  // Inbox `l`: open Land on this agent's card.
  landAgent(a, cx) {
    this.landWanted = a;
    this.show("Land", cx);
  }

  remove(item, cx) {
    this.start(cx, "clean", item.machine, item.path);
    this.clean = this.clean.filter((row) => row !== item);
    this.sel = move(this.sel, 0, this.clean.length);
  }

  // Destructive actions take two presses within GUARD_MS; the label resets after that.
  press(id, cx, action) {
    const r = pressGuard(this.armed, id, Date.now());
    this.armed = r.armed;
    if (r.fire) return action(cx);
    const armed = this.armed;
    cx.timer.after(GUARD_MS, (cx) => { if (this.armed === armed) { this.armed = null; cx.notify(); } });
  }

  onKey(e, cx) {
    const action = keyAction(e.key, this.tab, { typing: this.typing });
    if (!action) return;
    cx.stop_propagation();
    if (action === "close") return closeOverlay(props().overlay);
    if (action === "blur") { this.typing = false; this.handle.focus(); }
    else if (action.tab) this.show(action.tab, cx);
    else if (action === "up" || action === "down") this.sel = move(this.sel, action === "up" ? -1 : 1, this.rows().length);
    else if (action === "enter") this.enter(cx);
    else if (action === "back") this.back();
    else {
      const item = this.rows()[this.sel];
      if (item && action === "land") this.landAgent(item, cx);
      if (item && action === "opinion") this.start(cx, "review", item.machine, item.cwd, item.workspace ?? "");
    }
    cx.notify();
  }

  feedbackFor(id) {
    let input = this.feedback.get(id);
    if (!input) {
      input = InputState.new({ placeholder: "What should the agent change?" });
      input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
      input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
      this.feedback.set(id, input);
    }
    return input;
  }

  // ---- Rendering --------------------------------------------------------------------

  render(cx) {
    const t = theme();
    const counts = {
      Inbox: this.inboxRows().length,
      Dispatch: this.queue.length,
      Stuck: this.stuckRows().length,
    };
    this.sel = move(this.sel, 0, this.rows().length);
    const body = {
      Inbox: () => this.agents(this.inboxRows(), "Nothing needs you."),
      Stuck: () => this.agents(this.stuckRows(), "No agent looks stuck."),
      Dispatch: () => this.dispatch(cx),
      Land: () => this.landing(cx),
      Clean: () => this.cleanup(cx),
    }[this.tab]();

    return v_flex().id("gaucho").size_full().min_h(0).bg(t.chrome).text_color(t.foreground).text_size(12.5)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.onKey(e, cx))
      .child(h_flex().id("gaucho-tabs").p(8).gap(4).children(TABS.map((tab, i) => {
        const count = counts[tab] || 0;
        return h_flex().id(`gaucho-tab-${tab}`).px(8).h(26).gap(6).items_center().rounded(6).cursor_pointer()
          .bg(this.tab === tab ? t.selected : t.chrome).hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { this.show(tab, cx); cx.notify(); })
          .child(div().text_color(t.dim).text_size(11).child(String(i + 1)))
          .child(count ? `${tab} ${count}` : tab);
      })))
      .when(Boolean(this.error), (el) => el.child(
        div().id("gaucho-error").mx(8).px(8).py(4).rounded(6).bg(t.ansi1 ?? t.blocked).text_color(t.background ?? t.foreground)
          .child(this.error)))
      .child(v_flex().id("gaucho-body").flex_1().min_h(0).p(8).gap(4).overflow_y_scrollbar().child(body))
      .child(div().px(12).py(6).text_size(11).text_color(t.dim).child(this.hint()));
  }

  hint() {
    const extra = { Inbox: "l land", Land: "o second opinion", Dispatch: "⌫ back" }[this.tab];
    return ["1-5 tabs", "↑↓ select", "↵ open", extra, "esc close"].filter(Boolean).join("  ·  ");
  }

  empty(text) {
    return div().p(12).text_color(theme().dim).child(text);
  }

  // `selected` draws the keyboard selection; hover still works for the mouse.
  row(id, title, detail, selected, onClick) {
    const t = theme();
    return v_flex().id(id).p(8).gap(2).rounded(6).cursor_pointer()
      .bg(selected ? t.selected : t.chrome).hover((s) => s.bg(t.hover))
      .on_click(onClick)
      .child(div().truncate().child(title))
      .child(div().truncate().text_size(11.5).text_color(t.dim).child(detail));
  }

  button(id, text, onClick, danger) {
    const t = theme();
    return h_flex().id(id).h(26).px(10).items_center().rounded(6).cursor_pointer().bg(t.raised)
      .text_color(danger ? t.blocked : t.foreground).hover((s) => s.bg(t.hover))
      .on_click(onClick).child(text);
  }

  // Destructive buttons: the first press arms ("Sure?"), the second within 3s fires.
  guarded(id, text, action) {
    const armed = this.armed?.id === id;
    return this.button(id, armed ? `Sure? ${text}` : text, (_e, cx) => { this.press(id, cx, action); cx.notify(); }, true);
  }

  agents(list, none) {
    if (!list.length) return this.empty(none);
    const t = theme();
    return v_flex().gap(2).children(list.map((a, i) => {
      const where = a.machine === "local" ? "" : ` · ${a.machine}`;
      const color = a.group === "stuck" ? t.blocked : (t[a.status] ?? t.unknown);
      return this.row(`gaucho-a-${a.key}`, a.run?.title ?? a.title ?? a.kind,
        `${a.label}${where} · ${a.kind}${a.stuck ? ` · ${a.stuck}` : ""}`, i === this.sel,
        () => this.focusAgent(a))
        .border_l(2).border_color(color);
    }));
  }

  breadcrumb(cwd) {
    const t = theme();
    const parts = [basename(cwd), this.source, this.issue?.text, this.issue ? "machine" : null].filter(Boolean);
    return h_flex().gap(6).px(4).pb(4).text_size(11.5).text_color(t.dim)
      .children(parts.map((p, i) => div().truncate().text_color(i === parts.length - 1 ? t.foreground : t.dim)
        .child(i ? `› ${p}` : p)));
  }

  dispatch(cx) {
    const cwd = this.folder();
    if (!cwd) return this.empty("Focus a terminal inside a repository.");
    const t = theme();
    const queue = this.queue.length
      ? v_flex().pt(8).gap(2).child(div().text_color(t.dim).child("Queue")).children(this.queue.map((item) =>
          h_flex().id(`gaucho-q-${item.ref}`).p(6).gap(6).items_center()
            .child(v_flex().flex_1().min_w(0)
              .child(div().truncate().child(item.title))
              .child(div().truncate().text_size(11.5).text_color(t.dim).child(`${item.failed ? "failed" : "queued"} · ${item.machine}`)))
            .child(this.button(`gaucho-qrm-${item.ref}`, "Remove", (_e, cx) => {
              this.start(cx, "queue", "rm", item.ref);
              this.queue = this.queue.filter((q) => q !== item);
              cx.notify();
            }))))
      : div();
    const head = this.breadcrumb(cwd);
    if (this.issue) {
      return v_flex().gap(4).child(head)
        .child(v_flex().gap(4).children(this.machines.map((machine, i) =>
          h_flex().id(`gaucho-m-${machine}`).p(6).gap(4).items_center().rounded(6)
            .bg(i === this.sel ? t.selected : t.chrome)
            .child(div().flex_1().min_w(0).truncate().child(machine))
            .child(this.button(`gaucho-go-${machine}`, "Start", (_e, cx) => {
              this.startAndClose(cx, "dispatch", this.source, this.issue.id, machine, cwd);
            }))
            .child(this.button(`gaucho-queue-${machine}`, "Queue", (_e, cx) => {
              this.startAndClose(cx, "queue", "add", this.source, this.issue.id, machine, cwd);
            }))
            .when(machine !== "local", (el) => el.child(this.button(`gaucho-clone-${machine}`, "Clone + start", (_e, cx) => {
              this.startAndClose(cx, "dispatch", "--clone", this.source, this.issue.id, machine, cwd);
            }))))))
        .child(queue);
    }
    if (!this.source) {
      if (!this.sources.length) return v_flex().child(head).child(this.empty("No issue source matches this repository.")).child(queue);
      return v_flex().gap(2).child(head).children(this.sources.map((source, i) =>
        this.row(`gaucho-s-${source}`, source, "Issue source", i === this.sel, (_e, cx) => { this.pick(source, cx); cx.notify(); })))
        .child(queue);
    }
    if (!this.issues.length) return v_flex().child(head).child(this.empty("No open issues.")).child(queue);
    return v_flex().gap(2).child(head).children(this.issues.map((issue, i) =>
      this.row(`gaucho-i-${issue.id}`, issue.text, this.source, i === this.sel, (_e, cx) => { this.issue = issue; this.sel = 0; cx.notify(); })))
      .child(queue);
  }

  landing(cx) {
    if (this.land === null) return this.empty("Reading branches...");
    if (!this.land.length) return this.empty("Nothing to land.");
    const t = theme();
    return v_flex().gap(8).children(this.land.map((item, i) => {
      const id = `${item.machine}:${item.cwd}`;
      const input = this.feedbackFor(id);
      // Takes the current card: the submit handler outlives this render.
      const sendBack = (card, cx) => {
        const text = input.value();
        if (!text) return;
        this.start(cx, "land-action", "send-back", card.machine, card.cwd, card.agent, text);
        input.set_value?.("");
      };
      if (!input.submitBound) {
        input.on("submit", (_e, cx) => { const card = this.land?.find((x) => `${x.machine}:${x.cwd}` === id); if (card) sendBack(card, cx); cx.notify(); });
        input.submitBound = true;
      }
      return v_flex().id(`gaucho-l-${id}`).p(8).gap(6).rounded(6).bg(i === this.sel ? t.selected : t.raised)
        .child(div().truncate().child(item.run?.title ?? item.branch))
        .child(div().text_size(11.5).text_color(t.dim).child(
          `${item.machine} · ${item.branch} · +${item.ahead}${item.dirty ? ` · ${item.dirty} uncommitted` : ""} · ${item.stat}`))
        .child(h_flex().gap(4).flex_wrap()
          .child(this.button(`gaucho-pr-${id}`, "Open PR", (_e, cx) => {
            this.start(cx, "land-action", "open-pr", item.machine, item.cwd, item.agent);
          }))
          .child(this.button(`gaucho-rv-${id}`, "Second opinion", (_e, cx) => {
            this.start(cx, "review", item.machine, item.cwd, item.workspace ?? "");
          }))
          .child(this.guarded(`gaucho-dc-${id}`, "Discard", (cx) => {
            this.start(cx, "land-action", "discard", item.machine, item.cwd, item.agent);
          })))
        .child(h_flex().gap(4)
          .child(div().id(`gaucho-fb-${id}`).flex_1().min_w(0).h(26).px(6).flex().items_center().rounded(6).border_1()
            .border_color(t.input).bg(t.background).cursor_text()
            .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
            .child(Input.new(input).h_full()))
          .child(this.button(`gaucho-sb-${id}`, "Send back", (_e, cx) => { sendBack(item, cx); cx.notify(); })));
    }));
  }

  cleanup(cx) {
    if (this.clean === null) return this.empty("Checking worktrees...");
    if (!this.clean.length) return this.empty("No worktrees found.");
    const t = theme();
    return v_flex().gap(4).children(this.clean.map((item, i) => {
      const id = `gaucho-c-${item.machine}:${item.path}`;
      return h_flex().id(`${id}-row`).p(6).gap(6).items_center().rounded(6).bg(i === this.sel ? t.selected : t.chrome)
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().child(item.branch))
          .child(div().truncate().text_size(11.5).text_color(t.dim).child(`${item.machine} · ${item.reason}`)))
        .when(item.removable, (el) => el.child(this.guarded(id, "Remove", (cx) => this.remove(item, cx))));
    }));
  }
}
