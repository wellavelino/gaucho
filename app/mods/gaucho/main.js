// Gaucho for the Herdr desktop app. A thin view: all logic lives in core/gaucho,
// the same engine the terminal plugins use, so the two can never disagree.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, appHome, closeOverlay, focused, notify, props, run, theme } from "herdr";

const TABS = ["Inbox", "Fleet", "Dispatch", "Land", "Clean"];
const STATUS_ORDER = { blocked: 0, done: 1, working: 2, idle: 3 };

const engine = () => `${appHome()}/mods/gaucho/core/gaucho`;

async function gaucho(...args) {
  const r = await exec("bash", [engine(), "--runtime", "hc", ...args]);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || "Gaucho failed").trim());
  return r.stdout;
}

const json = async (...args) => JSON.parse((await gaucho(...args)) || "null");

export default class Gaucho extends View {
  init(_props, cx) {
    this.tab = "Inbox";
    this.fleet = [];
    this.queue = [];
    this.land = null;
    this.clean = null;
    this.sources = [];
    this.source = null;
    this.issues = [];
    this.issue = null;
    this.machines = ["local"];
    this.armed = null; // The row waiting for a second click on a destructive action.
    this.error = null;
    this.feedback = InputState.new({ placeholder: "What should the agent change?" });
    this.refresh(cx);
    cx.timer.every(5000, (cx) => this.refresh(cx));
    // Delivery, stuck detection and the queue. Nothing here runs while the app is closed.
    cx.timer.every(20000, (cx) => cx.spawn(async () => { await gaucho("job", "tick").catch(() => {}); }));
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      try {
        this.fleet = (await json("fleet")).sort(
          (a, b) => (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4));
        this.queue = await json("queue", "list");
        for (const job of await json("jobs")) this.report(job);
        this.error = null;
      } catch (e) {
        this.error = String(e.message ?? e);
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
      await gaucho("job", ...args).catch((e) => { this.error = String(e.message ?? e); });
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
        this.error = String(e.message ?? e);
        cx.notify();
      }
    });
  }

  show(tab, cx) {
    this.tab = tab;
    this.armed = null;
    if (tab === "Land") this.load(cx, "land", () => json("land-list"));
    if (tab === "Clean") this.load(cx, "clean", () => json("clean-list"));
    if (tab === "Dispatch") this.loadDispatch(cx);
  }

  load(cx, key, read) {
    this[key] = null;
    cx.spawn(async (cx) => {
      try { this[key] = await read(); } catch (e) { this.error = String(e.message ?? e); this[key] = []; }
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
        if (!cwd) return;
        const r = await exec("bash", [engine(), "--runtime", "hc", "sources"], { cwd });
        this.sources = r.stdout.split("\n").filter(Boolean);
        if (this.sources.length === 1) await this.loadIssues(this.sources[0]);
      } catch (e) {
        this.error = String(e.message ?? e);
      }
      cx.notify();
    });
  }

  async loadIssues(source) {
    this.source = source;
    const r = await exec("bash", [engine(), "--runtime", "hc", "source", source, "list"], { cwd: this.folder() });
    this.issues = r.stdout.split("\n").filter(Boolean).map((line) => {
      const [id, text] = line.split("\t");
      return { id, text };
    });
  }

  render(cx) {
    const t = theme();
    const needs = this.fleet.filter((a) => a.status === "blocked" || a.status === "done");
    const stuck = this.fleet.filter((a) => a.stuck);
    const body = {
      Inbox: () => this.agents(needs, "Nothing needs you."),
      Fleet: () => this.agents(this.fleet, "No agents are running."),
      Dispatch: () => this.dispatch(cx),
      Land: () => this.landing(cx),
      Clean: () => this.cleanup(cx),
    }[this.tab]();

    return v_flex().w_full().h(560).bg(t.chrome).text_color(t.foreground).text_size(12.5)
      .child(h_flex().id("gaucho-tabs").p(8).gap(4).children(TABS.map((tab) => {
        const count = tab === "Inbox" ? needs.length : tab === "Dispatch" ? this.queue.length : 0;
        return h_flex().id(`gaucho-tab-${tab}`).px(8).h(26).items_center().rounded(6).cursor_pointer()
          .bg(this.tab === tab ? t.selected : t.chrome).hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { this.show(tab, cx); cx.notify(); })
          .child(count ? `${tab} ${count}` : tab);
      })))
      .when(stuck.length > 0, (el) => el.child(
        div().px(12).py(4).text_color(t.blocked).child(`${stuck.length} agent${stuck.length > 1 ? "s" : ""} may be stuck`)))
      .when(Boolean(this.error), (el) => el.child(div().px(12).py(4).text_color(t.blocked).child(this.error)))
      .child(v_flex().id("gaucho-body").flex_1().min_h(0).p(8).gap(4).overflow_y_scrollbar().child(body));
  }

  empty(text) {
    return div().p(12).text_color(theme().dim).child(text);
  }

  row(id, title, detail, onClick) {
    const t = theme();
    return v_flex().id(id).p(8).gap(2).rounded(6).cursor_pointer().hover((s) => s.bg(t.hover))
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

  // Destructive actions take two clicks.
  guarded(id, text, cx, action) {
    const armed = this.armed === id;
    return this.button(id, armed ? `Click again: ${text}` : text, (_e, cx) => {
      if (armed) { this.armed = null; action(cx); } else { this.armed = id; }
      cx.notify();
    }, true);
  }

  agents(list, none) {
    if (!list.length) return this.empty(none);
    const t = theme();
    return v_flex().gap(2).children(list.map((a) => {
      const color = t[a.status] ?? t.unknown;
      const where = a.machine === "local" ? "" : ` · ${a.machine}`;
      return this.row(`gaucho-a-${a.key}`, a.run?.title ?? a.title ?? a.kind,
        `${a.status}${where} · ${a.kind}${a.stuck ? ` · ${a.stuck}` : ""}`,
        () => run("agent.focus", { terminal: a.machine === "local" ? a.id : `${a.machine}/${a.id}` }))
        .border_l_2().border_color(color);
    }));
  }

  dispatch(cx) {
    const cwd = this.folder();
    if (!cwd) return this.empty("Focus a terminal inside a repository.");
    const queue = this.queue.length
      ? v_flex().pt(8).gap(2).child(div().text_color(theme().dim).child("Queue")).children(this.queue.map((item) =>
          this.row(`gaucho-q-${item.ref}`, item.title, `${item.failed ? "failed" : "queued"} · ${item.machine}`,
            (_e, cx) => { this.start(cx, "queue", "rm", item.ref); cx.notify(); })))
      : div();
    if (this.issue) {
      return v_flex().gap(4)
        .child(div().p(4).child(`Send ${this.issue.text} to:`))
        .child(v_flex().gap(4).children(this.machines.map((machine) =>
          h_flex().gap(4)
            .child(this.button(`gaucho-go-${machine}`, machine, (_e, cx) => {
              this.startAndClose(cx, "dispatch", this.source, this.issue.id, machine, cwd);
            }))
            .when(machine !== "local", (el) => el.child(this.button(`gaucho-clone-${machine}`, "Clone if missing", (_e, cx) => {
              this.startAndClose(cx, "dispatch", "--clone", this.source, this.issue.id, machine, cwd);
            })))
            .child(this.button(`gaucho-queue-${machine}`, "Queue", (_e, cx) => {
              this.startAndClose(cx, "queue", "add", this.source, this.issue.id, machine, cwd);
            })))))
        .child(this.button("gaucho-back", "Back", (_e, cx) => { this.issue = null; cx.notify(); }));
    }
    if (!this.source) {
      if (!this.sources.length) return v_flex().child(this.empty("No issue source matches this repository.")).child(queue);
      return v_flex().gap(2).children(this.sources.map((source) =>
        this.row(`gaucho-s-${source}`, source, "Issue source", (_e, cx) => {
          cx.spawn(async (cx) => { await this.loadIssues(source); cx.notify(); });
        }))).child(queue);
    }
    return v_flex().gap(2).children(this.issues.map((issue) =>
      this.row(`gaucho-i-${issue.id}`, issue.text, this.source, (_e, cx) => { this.issue = issue; cx.notify(); })))
      .child(queue);
  }

  landing(cx) {
    if (this.land === null) return this.empty("Reading branches...");
    if (!this.land.length) return this.empty("Nothing to land.");
    return v_flex().gap(8).children(this.land.map((item) => {
      const id = `${item.machine}:${item.cwd}`;
      return v_flex().id(`gaucho-l-${id}`).p(8).gap(6).rounded(6).bg(theme().surface)
        .child(div().truncate().child(item.run?.title ?? item.branch))
        .child(div().text_size(11.5).text_color(theme().dim).child(
          `${item.machine} · +${item.ahead}${item.dirty ? ` · ${item.dirty} uncommitted` : ""} · ${item.stat}`))
        .child(h_flex().gap(4).flex_wrap()
          .child(this.button(`gaucho-pr-${id}`, "Open PR", (_e, cx) => {
            this.start(cx, "land-action", "open-pr", item.machine, item.cwd, item.agent);
          }))
          .child(this.button(`gaucho-rv-${id}`, "Second opinion", (_e, cx) => {
            this.start(cx, "review", item.machine, item.cwd, item.workspace ?? "");
          }))
          .child(this.guarded(`gaucho-dc-${id}`, "Discard", cx, (cx) => {
            this.start(cx, "land-action", "discard", item.machine, item.cwd, item.agent);
          })))
        .child(h_flex().gap(4)
          .child(Input.new(this.feedback).flex_1().h(26).px(6).rounded(6).border_1().border_color(theme().input).bg(theme().background))
          .child(this.button(`gaucho-sb-${id}`, "Send back", (_e, cx) => {
            const text = this.feedback.value();
            if (text) this.start(cx, "land-action", "send-back", item.machine, item.cwd, item.agent, text);
          })));
    }));
  }

  cleanup(cx) {
    if (this.clean === null) return this.empty("Checking worktrees...");
    if (!this.clean.length) return this.empty("No worktrees found.");
    return v_flex().gap(4).children(this.clean.map((item) => {
      const id = `gaucho-c-${item.machine}:${item.path}`;
      return h_flex().id(`${id}-row`).p(6).gap(6).items_center()
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().child(item.branch))
          .child(div().truncate().text_size(11.5).text_color(theme().dim).child(`${item.machine} · ${item.reason}`)))
        .when(item.removable, (el) => el.child(this.guarded(id, "Remove", cx, (cx) => {
          this.start(cx, "clean", item.machine, item.path);
          this.clean = this.clean.filter((row) => row !== item);
        })));
    }));
  }
}
