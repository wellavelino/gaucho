# Gaucho

Every Gaucho screen in one popup: a tab bar, a row of buttons for the selected
item, and a preview of it.

| Tab | Lists | Buttons |
| --- | --- | --- |
| Inbox | blocked and finished agents | Jump, Dispatch |
| Fleet | every agent | Jump, Dispatch |
| Stuck | agents that stopped making progress | Jump, Dispatch |
| Queue | issues waiting to start | Remove, Dispatch |
| Land | finished branches | Open PR, Send back, Second opinion, Tests, Discard |
| Clean | worktrees, with why each is kept or can go | Remove |

Click a tab or a button, or use the keys: `1`–`6` or `tab` for tabs, and the
letter on each button (`↵` for the first). `ctrl-r` refreshes and `esc`
closes. After an action you come back to the hub; jumping to an agent or
dispatching closes it. The preview shows the agent's screen, the branch's
commits and checks, or the queued issue.

Clicking needs fzf 0.48 or newer. With an older fzf the buttons are keys only.

The hub runs the same engine as the other plugins, so you can install it alone
or next to them.

## Key

```toml
[[keys.command]]
key = "prefix+a"
type = "plugin_action"
command = "gaucho.hub.open"
description = "gaucho"
```

Add the [tab bar entry](../agent-inbox#tab-bar) too: it drives delivery, stuck
detection and the queue.

## Requirements

Needs `git`, `jq`, `fzf`, `gum` and `gh` on the machine running Herdr. See
[Requirements](../../README.md#requirements) for install commands.
