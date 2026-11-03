# Second Opinion

Starts a fresh agent in a new tab to review a finished branch. It sees the code,
not the first agent's reasoning.

Use a different agent for a more independent read: `GAUCHO_REVIEW_AGENT=codex`.
Change the brief by copying `core/templates/review.md` to
`~/.config/gaucho/templates/review.md`.

The reviewer shares the worktree and is told not to edit it. That is an
instruction, not a sandbox, so only review while the first agent is idle.
Bind `gaucho.second-opinion.open` to a key.

## Requirements

Needs `git`, `jq`, `fzf` and `gum` on the machine running Herdr. See
[Requirements](../../README.md#requirements) for install commands.
