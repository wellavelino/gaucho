# Gaucho

Every Gaucho screen in one popup, with live counts: Inbox, Fleet, Stuck,
Dispatch, Queue, Land, Second opinion and Clean. Press Enter or 1–8 to open a
screen. Closing a screen brings you back here; jumping to an agent or
dispatching an issue closes the popup. Esc closes it.

The hub runs the same screens as the other plugins, so you can install it
alone or next to them.

## Key

```toml
[[keys.command]]
key = "prefix+g"
type = "plugin_action"
command = "gaucho.hub.open"
description = "gaucho"
```

Add the [tab bar entry](../agent-inbox#tab-bar) too: it drives delivery, stuck
detection and the queue.

## Requirements

Needs `git`, `jq`, `fzf`, `gum` and `gh` on the machine running Herdr. See
[Requirements](../../README.md#requirements) for install commands.
