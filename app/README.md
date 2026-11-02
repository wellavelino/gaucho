# Gaucho for the Herdr desktop app

The desktop app does not load `herdr-plugin.toml` plugins. It has JavaScript mods
and runs on herdr-core (`hc`) instead, so Gaucho ships one mod on the same engine.
It adds a popup with Inbox, Fleet, Dispatch, Land and Clean. Landing includes
Second Opinion, and a banner shows stuck agents.

```sh
app/install.sh
```

Then add a key to `~/.config/herdr-app/keys.json`, under `global`:

```json
"ctrl-shift-g": "mod.open:gaucho"
```

Run `app/install.sh` again after updating Gaucho.

- Delivery, stuck detection and the queue run while the app is open.
- The mod uses the `hc` runtime and keeps its own state, separate from the plugins.
- Gaucho only sees agents that report status (OSC 7501).
- Dispatch reads issues from the focused local repository. A focused remote space
  has no local checkout, so open the repository locally to pick issues.
