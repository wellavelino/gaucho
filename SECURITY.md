# Security and privacy

Gaucho runs as you, unsandboxed, like any Herdr plugin or mod. Read it before you
install it.

**Nothing leaves your machines through Gaucho itself.** There is no telemetry and
no Gaucho server. Data goes only where you send it: your own machines, your
agents, and your issue tracker and code host.

**What it stores.** Everything is under `~/.local/state/gaucho`, readable only by
you: agent states, run records, the queue, and briefs waiting to be sent. Briefs
hold issue text and are deleted once sent. Agent screens are never stored, only
hashes of them.

**What a pull request contains.** The issue link and commit subjects.

**What it will not do.** It never answers an agent's prompt, types into a blocked
agent, runs a command from a repository, or removes work without your say-so.

**Untrusted text.** Issues and diffs are written by other people and go to your
agents. Gaucho fences them off, but that is not a guarantee. Titles from agents
are stripped of terminal escape sequences before display.

**For contributors.** Personal settings belong in `~/.config/gaucho`, never in
this repository.

Report a vulnerability through a private GitHub security advisory, not an issue.
