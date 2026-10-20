# Changelog

All notable changes to `agent-repl` are documented here.

## [Unreleased]

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
