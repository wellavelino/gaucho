# Agent Inbox

See which agents on any machine need you, and jump to them. Includes every
enabled saved machine. A machine that stops answering keeps its last list for
two minutes, marked `stale`.

Press Enter to jump. A local agent is focused in place. An agent on a saved
machine is focused on that machine, so it is in front when you switch to it,
and opens over ssh as an attached terminal in the popup, because Herdr cannot
switch your window to another machine from the CLI.

## Requirements

Needs `git`, `jq`, `fzf` and `gum` on the machine running Herdr. See
[Requirements](../../README.md#requirements) for install commands.

## Key

```toml
[[keys.command]]
key = "prefix+i"
type = "plugin_action"
command = "gaucho.agent-inbox.open"
description = "agent inbox"
```

## Tab bar

This one entry shows blocked, finished, stuck, waiting and queued counts. It also
drives brief delivery, stuck detection and the queue, so add it even if you do
not want to look at it. It prints nothing when nothing is waiting.

```toml
[ui]
tab_bar_right = [
  { type = "command", command = "/path/to/gaucho/core/gaucho status", interval_seconds = 5, timeout_seconds = 5 },
]
```
