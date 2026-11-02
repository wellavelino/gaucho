# Cleanup

Lists worktrees on every machine and offers only the safe ones: merged, with no
uncommitted files and no agent inside. Squash merges count when the forge says
the pull request merged. Each one is checked again just before removal.

It deletes the local worktree and branch. It never touches remote branches.
Bind `gaucho.cleanup.open` to a key.
