# Issue Dispatch

Pick an issue and a machine. Gaucho makes a worktree there, starts an agent and
gives it the issue as a brief.

- Choose several issues with Tab and they join the queue instead.
- If an agent stops at a startup question, such as Claude's folder trust prompt,
  Gaucho waits. It never answers for you. The brief is sent once the agent is
  ready, for up to 24 hours (`GAUCHO_PENDING_HOURS`).

## Queue

The queue starts the next issue when a machine has room. The limit is 2 agents
per machine. Set `GAUCHO_QUEUE_LIMIT=3`, or per machine with
`GAUCHO_QUEUE_LIMITS="local=1 buildbox=4"`. Failed items stay in the queue,
marked `FAILED`, and are never retried by themselves. The queue moves when the
tab bar entry from [Agent Inbox](../agent-inbox) runs.

Bind `gaucho.issue-dispatch.open` and `gaucho.issue-dispatch.queue` to keys.

## Other trackers

Add a source for Jira, Linear or anything else. See
[Extending Gaucho](../../docs/extending.md).

## Security

Anyone who can file an issue can write text your agent will read. The brief
fences it off and says to treat it as a task description, but that is not a
guarantee. Read issues from strangers before dispatching them.
