# Changelog

All notable changes to `agent-repl` are documented here.

## [Unreleased]

### Documentation
- Set `PI_REPL_AGENT_LABEL` in the OpenCode configuration example: OpenCode 2 identifies itself to MCP servers only as `cli`.

## [0.1.0] — 2026-09-25

First public release.

### Added
- `agent-repl mcp`: an MCP server with pi-repl's `repl_start`, `repl_status` and `repl_send` tools, for Claude Code, Codex, OpenCode and other agents. pi-repl's guidance for agents is kept within Claude Code's 2,048-character limit on tool descriptions by attaching runtime notes to the `target` parameter.
- `agent-repl <runtime>`, `status`, `attach`, `env`, `export` and `stop`: pi-repl's `/repl` commands in a terminal. Starting a runtime attaches to it when run in a terminal.
- Clean-record entries name the agent that sent them, from the MCP client's name, or `PI_REPL_AGENT_LABEL` when set.
- Generated from pi-repl 0.8.1, with pi-repl's own test suite run against the generated copy.
