# Extending Gaucho

Every extension is an executable in any language. Drop it in a folder under
`~/.config/gaucho/` and it is found by name. Yours win over built-ins with the
same name. Keep secrets in your own environment, never in this repository.

| Folder | Adds | Examples |
| --- | --- | --- |
| `sources/` | an issue tracker | Jira, Linear |
| `forges/` | a code host | GitLab, Gitea |
| `detectors/` | a way to spot a stuck agent | your own heuristics |
| `land-actions/` | a step on the landing screen | deploy a preview |
| `runtimes/` | a place agents run | another multiplexer |
| `templates/` | your own `issue.md` or `review.md` brief | house rules |

Settings go in `~/.config/gaucho/config.env`.

## Sources

Run in the repository, from any machine you dispatch from.

| Call | Does |
| --- | --- |
| `detect` | exits 0 if this source applies here |
| `list` | prints `ID<TAB>text` per issue |
| `show ID` | prints the issue for people |
| `get ID` | prints JSON with `title`, `body` and `url` |

```bash
#!/usr/bin/env bash
# ~/.config/gaucho/sources/jira. A sketch: adapt the query to your tracker.
case $1 in
  detect) [[ -f .jira-project ]] ;;
  list) jira issue list --plain --no-headers --columns key,summary ;;
  show) jira issue view "$2" --plain ;;
  get) jira issue view "$2" --raw | jq '{title: .fields.summary, body: .fields.description, url: .self}' ;;
esac
```

## Forges

Run on this machine, so a remote machine needs no forge login. `URL` is the
`origin` remote.

| Call | Does |
| --- | --- |
| `detect URL` | exits 0 if this forge handles the remote |
| `pr-status URL BRANCH` | prints JSON `state`, `url`, `title`, `passed`, `failed`, `total`, or `null`. `state` is `MERGED` once merged |
| `pr-create URL BRANCH BASE TITLE BODY_FILE` | opens a pull request |
| `merged-branches URL` | optional. Prints `BRANCH<TAB>HEAD_COMMIT` per merged pull request, so Cleanup makes one call per repository. Exit non-zero if unsupported, and Cleanup falls back to `pr-status` per branch |

## Detectors

Receive a JSON agent on stdin with `kind`, `machine`, `cwd`, `working_ms`,
`quiet_ms` and `repeats`. Print a reason if it looks stuck, nothing otherwise.

## Land actions

| Call | Does |
| --- | --- |
| `describe` | prints a label |
| `needs` | prints `none`, `confirm` or `input:Your question` |
| `run` | does the work |

`run` gets `GAUCHO_MACHINE`, `GAUCHO_CWD`, `GAUCHO_BRANCH`, `GAUCHO_BASE`,
`GAUCHO_AGENT_ID`, `GAUCHO_INPUT` and `GAUCHO_BIN`, the path to the engine.

## Runtimes

The adapter between Gaucho and whatever runs agents. `M` is `local` or a machine.
`core/runtimes/herdr` and `core/runtimes/hc` are full examples.

| Call | Does |
| --- | --- |
| `machines` | prints enabled machines, one per line |
| `agents M` | prints a JSON array with `id`, `status`, `kind`, `cwd`, `title`, `workspace`, `since_ms` |
| `read M ID LINES` | prints the agent's recent output |
| `focus M ID` | shows the agent to the user |
| `prompt M ID TEXT` | sends text. Must refuse a blocked agent |
| `exec M CWD ARGV...` | runs a program and passes through its output and exit code |
| `worktree-add M CHECKOUT BRANCH BASE LABEL` | prints JSON `slot`, `cwd` |
| `tab-add M CWD WORKSPACE LABEL` | prints JSON `slot`, `cwd` |
| `start M SLOT KIND NAME` | starts an agent and prints its ID |
| `worktree-remove M REPO PATH` | removes a worktree |
| `notify TITLE BODY` | tells the user something |

Status is `idle`, `working`, `blocked`, `done` or `unknown`.

## The engine

The plugins, the hub and the desktop mods all call `core/gaucho`, and so can
your scripts. `core/gaucho help` prints a short summary. `M` is
`local` or a saved machine. Commands print JSON unless they say otherwise, and
those marked `--tsv` can print tab-separated rows.

| Command | Does |
| --- | --- |
| `gaucho fleet [--tsv]` | Lists every agent on every machine |
| `gaucho inbox [--tsv]` | Lists blocked and finished agents |
| `gaucho stuck [--tsv]` | Lists agents that look stuck |
| `gaucho status [--no-work]` | Prints the tab bar summary and starts background work, unless `--no-work` |
| `gaucho machines` | Lists `local` and enabled machines |
| `gaucho read M ID [LINES]` | Prints an agent's recent output |
| `gaucho focus M ID` | Jumps to an agent |
| `gaucho prompt M ID TEXT` | Sends text to an agent |
| `gaucho sources` | Lists issue sources for the current repository |
| `gaucho source NAME VERB [ID]` | Calls a source directly |
| `gaucho dispatch [--clone] SOURCE ID M CWD` | Sends an issue to a new worktree and agent |
| `gaucho queue add SOURCE ID M CWD` | Adds an issue to the queue |
| `gaucho queue list [--tsv]` | Shows the queue |
| `gaucho queue rm REF` | Removes a queue item |
| `gaucho land-list [--tsv]` | Lists finished branches |
| `gaucho land-info M CWD [--json]` | Describes a branch and its pull request |
| `gaucho land-actions` | Lists landing steps |
| `gaucho land-action NAME M CWD [AGENT] [INPUT]` | Runs a landing step, with no confirmation |
| `gaucho review M CWD [WORKSPACE]` | Starts a second-opinion agent |
| `gaucho clean-list [--tsv]` | Lists worktrees and whether each is safe to remove |
| `gaucho clean M PATH` | Removes a merged worktree and its branch |
| `gaucho tick` | Delivers briefs, checks for stuck agents and moves the queue |
| `gaucho deliver` | Waits and sends held briefs |
| `gaucho background COMMAND...` | Runs a command detached and reports by notification |
| `gaucho job COMMAND...` | Runs a command detached for callers with a time limit |
| `gaucho jobs` | Prints finished job results once |
| `gaucho help` | Prints a short summary |

Add `--runtime NAME` before a command to choose a runtime, such as
`gaucho --runtime hc fleet`. Without it, Gaucho picks Herdr, then `hc`.
