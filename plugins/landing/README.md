# Landing

Lists finished agents with work on a branch, on every machine. Shows commits,
changes, uncommitted files and pull request checks, then lets you:

- **Open a pull request.** Pushes the branch and opens a draft. Set
  `GAUCHO_PR_DRAFT=0` for a ready one. The text is the issue link and commit
  subjects, nothing about your machine.
- **Send back.** Gives the agent your feedback.
- **Run tests.** Runs `GAUCHO_TEST_CMD` from your config in the worktree. Gaucho
  never runs a command that came from a repository.
- **Discard.** Deletes the worktree and branch after you confirm, including
  unpushed work. Refused while an agent is working there.

Add your own actions: see [Extending Gaucho](../../docs/extending.md).
Bind `gaucho.landing.open` to a key.

## Requirements

Needs `git`, `jq`, `fzf`, `gum` and `gh` on the machine running Herdr. See
[Requirements](../../README.md#requirements) for install commands.
