# Changelog

All notable changes to `agent-repl` are documented here.

## [Unreleased]

### Added
- Generated from pi-repl 0.11.6: LFortran's session has a clean record. The cells sent through agent-repl, the agent's and `agent-repl send lfortran`'s, are recorded, `agent-repl status lfortran` shows where, and `agent-repl export lfortran` writes the record as Markdown. Cells you run at LFortran's prompt aren't recorded.

### Changed
- `agent-repl send lfortran` records under your name, with a `cli:send:` request ID, as `send` does for the other runtimes. Like `send`, it refuses empty code, invalid UTF-8 and code over 200,000 characters, and it refuses `--notice` and `--lease-wait`, which are for the pane runtimes.

## [0.4.4] — 2026-10-30

### Added
- `agent-repl name [name|--clear]` shows, sets or clears the name your own sends are recorded under. The name is saved for your account and shared with Pi's `/repl name`; `PI_REPL_USER_NAME` overrides it, and `User` is used when neither is set. `agent-repl send` and `env` record under it, with `cli:send:` and `cli:env:` request IDs, and say so if the saved name can't be used. `agent-repl send lfortran` is still recorded as `/repl send` for now.

### Changed
- Generated from pi-repl 0.11.5, by way of 0.11.4: late `/repl send` and `/repl env` results in Pi's conversation, and people's names in the record. agent-repl has no conversation, so the late results change nothing here.

## [0.4.3] — 2026-10-30

### Changed
- Generated from pi-repl 0.11.3.
- When an agent's code outlasts `repl_send`'s wait, its output is recorded when it finishes, and the session stays held until then; the result tells the agent not to send it again. The MCP server waits for such sends before it exits, saying so on stderr every minute. A client that kills it sooner (the MCP SDK allows about four seconds) leaves the send without an owner, and its lease goes stale 30 seconds later.
- `agent-repl status` says which send holds a session.

## [0.4.2] — 2026-10-30

### Changed
- Generated from pi-repl 0.11.2.
- `agent-repl send` takes every runtime again, and waits until the code is done, however long it runs, so its output is recorded as its own and no other send can take it. That fixes 0.4.0's problem, which 0.4.1 avoided by taking only `lfortran`. After 20 seconds (`--notice <seconds>`) it says the code is still running. If another send has the session, it waits up to 60 seconds (`--lease-wait <seconds>`) for it, and gives up without sending. Ctrl-C before the code is sent cancels it; after that, the first press keeps waiting and a second stops waiting, with a warning. It sends nothing it can't record, and refuses empty code, invalid UTF-8, and code over 200,000 characters. `agent-repl env` waits the same way.

## [0.4.1] — 2026-10-29

### Fixed
- `agent-repl send` takes only `lfortran` for now. A send to another runtime waits 20 s, and a cell that ran longer outlasted the command: the session's send lease then lapsed, and the session's next send recorded that cell's late output as its own. LFortran's sends go through its helper, which matches output to cells, so they're unaffected. The other runtimes come back once pi-repl can wait for a cell to settle. Found in review.

## [0.4.0] — 2026-10-29

### Changed
- Generated from pi-repl 0.11.1.

### Added
- Experimental LFortran sessions, from pi-repl 0.11, which need LFortran's `main` branch. `agent-repl lfortran`, or `repl_start` with `runtime: "lfortran"`, starts `pi-repl-lfortran`: you work at LFortran's own prompt, and the agent's cells go to the same kernel through pi-repl's helper. `repl_send`, `repl_status`, and `agent-repl status`, `attach` and `stop` take `lfortran`.
- The `repl_input` tool answers a READ that one of the agent's LFortran cells waits on, and `agent-repl input <text>` answers it from a terminal.
- `agent-repl send [runtime]` runs code from stdin in a running session, as `repl_send` does, and prints the result.

## [0.3.5] — 2026-10-21

### Changed
- Generated from pi-repl 0.10.5.

### Fixed
- GHCi, Octave and MATLAB: the footer's Node helper is stopped after 5 s by a small Node supervisor instead of perl's `alarm`, so a Node startup hook that catches SIGALRM can no longer hold up the send. Perl is no longer needed.

## [0.3.4] — 2026-10-21

### Changed
- Generated from pi-repl 0.10.4.

### Fixed
- Echo Off: output that doesn't end its line is no longer lost, or followed by the loader line in the next result.
- GHCi: the footer's Node helper runs with a five-second alarm timeout, and Ctrl-C while it waits no longer leaves the send unfinished.
- Java: a footer that throws no longer leaves the send unfinished.

## [0.3.3] — 2026-10-20

### Changed
- Generated from pi-repl 0.10.3.

### Fixed
- gnuplot: stopping a session no longer fails on a Mac that runs processes as `nobody` (UID −2).

## [0.3.2] — 2026-10-20

### Changed
- Generated from pi-repl 0.10.2. Its stop helper can be told which of a host's own sessions are gnuplot sessions; agent-repl's behaviour is unchanged.

## [0.3.1] — 2026-10-20

### Changed
- Generated from pi-repl 0.10.1.

### Fixed
- Ruby: Ctrl-C while a send's footer waits no longer leaves the send unfinished.
- Octave: stopping a session no longer leaves an `octave-workspace` file in its working directory.
- Octave and MATLAB: the footer's Node helper runs with a five-second alarm timeout, and in Octave Ctrl-C while it waits no longer leaves the send unfinished.

## [0.3.0] — 2026-10-20

### Changed
- Generated from pi-repl 0.10.0. Its new run-start pane text needs Pi's run events, which agent-repl doesn't have, so `PI_REPL_PANE_ACTIVITY=on` and `send` both report pane text only in send results here, as the README now says. The attach notice now names the model provider.

### Fixed
- A tmux command killed at its timeout counts as failed even when it reports exit code 0, so a timed-out pane capture is no longer taken as an empty pane. From pi-repl 0.10.0.

## [0.2.0] — 2026-10-20

### Added
- `repl_send` starts its result with the pane text the agent hasn't seen since its own last send, such as what you typed at the prompt, and `repl_status` previews it. Set `PI_REPL_PANE_ACTIVITY=off` in the server's environment to turn this off. From pi-repl 0.9.0.

### Changed
- Generated from pi-repl 0.9.0.

## [0.1.6] — 2026-10-19

### Fixed
- `agent-repl attach`, and starting a runtime in a terminal, pass `-u` to tmux. In a terminal without a UTF-8 locale (`LANG` unset, as in Muxy), non-ASCII output such as λ or é showed as underscores.

## [0.1.5] — 2026-10-19

### Changed
- Generated from pi-repl 0.8.6.

### Fixed
- The 0.1.3 done-marker footer no longer waits without limit for its Node helper. In Julia and R, a Node startup hook (`NODE_OPTIONS`) that kept Node running held the cell's completion indefinitely. In Clojure, an interrupt while the footer waited left the tmux query running.

## [0.1.4] — 2026-10-19

### Changed
- Generated from pi-repl 0.8.5.

### Fixed
- Julia no longer leaves copies of a wrapped submission line in the output, as it did in panes narrower than the `include(...)` line, such as a detached session's default 80 columns.

## [0.1.3] — 2026-10-19

### Changed
- Generated from pi-repl 0.8.4.

### Fixed
- In the Summary and Full displays, output that doesn't end its line no longer runs into the done marker in Python, IPython, Julia, R and Clojure. The marker then stayed in the clean output, as in `c── done · id: … ──`.

## [0.1.2] — 2026-10-19

### Changed
- Generated from pi-repl 0.8.3.

### Fixed
- agent-repl works when the locale is not UTF-8, for example with `LANG` unset. Commands and tools failed with "no panes found", because tmux printed the tabs in its pane listings as `_`.

## [0.1.1] — 2026-10-19

### Changed
- Generated from pi-repl 0.8.2.

### Fixed
- `agent-repl stop` no longer refuses to run on macOS when a process of `nobody` (uid -2) is running.
- IPython shows an expression's value once, as `Out[N]: …`. It used to be printed again as a bare `repr`.

### Documentation
- Set `PI_REPL_AGENT_LABEL` in the OpenCode configuration example: OpenCode 2 identifies itself to MCP servers only as `cli`.

## [0.1.0] — 2026-09-25

First public release.

### Added
- `agent-repl mcp`: an MCP server with pi-repl's `repl_start`, `repl_status` and `repl_send` tools, for Claude Code, Codex, OpenCode and other agents. pi-repl's guidance for agents is kept within Claude Code's 2,048-character limit on tool descriptions by attaching runtime notes to the `target` parameter.
- `agent-repl <runtime>`, `status`, `attach`, `env`, `export` and `stop`: pi-repl's `/repl` commands in a terminal. Starting a runtime attaches to it when run in a terminal.
- Clean-record entries name the agent that sent them, from the MCP client's name, or `PI_REPL_AGENT_LABEL` when set.
- Generated from pi-repl 0.8.1, with pi-repl's own test suite run against the generated copy.
