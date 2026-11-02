# Stuck Detector

Flags working agents that look stuck and sends one notification. It never acts
on an agent.

| Detector | Flags an agent when | Setting |
| --- | --- | --- |
| `quiet` | its screen has not changed for 15 minutes | `GAUCHO_STUCK_QUIET_MINUTES` |
| `looping` | its screen keeps returning to the same content 4 times | `GAUCHO_STUCK_REPEATS` |
| `long-running` | it has worked for 60 minutes | `GAUCHO_STUCK_LONG_MINUTES` |

Screens are sampled once a minute (`GAUCHO_STUCK_SAMPLE_SECONDS`). Only a hash is
stored, never the text. These are guesses, so expect some false alarms. Sampling
needs the tab bar entry from [Agent Inbox](../agent-inbox).

Add your own detector: see [Extending Gaucho](../../docs/extending.md).
Bind `gaucho.stuck-detector.open` to a key.
