# Changelog

All notable changes to `agent-repl` are documented here.

## [Unreleased]

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
