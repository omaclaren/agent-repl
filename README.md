# agent-repl

Shared REPL sessions for coding agents. agent-repl starts a Python, IPython, Julia, R, Haskell (GHCi), Clojure, Ruby, Java, Octave, MATLAB, gnuplot or C++ REPL in tmux. You attach to it from a terminal and work there as normal. [Claude Code](https://docs.claude.com/en/docs/claude-code), [Codex](https://github.com/openai/codex), [OpenCode](https://opencode.ai) and other agents that support MCP run code in the same session, so you and the agent share one live workspace.

agent-repl is [pi-repl](https://github.com/omaclaren/pi-repl) running outside [Pi](https://pi.dev). The tools, runtime support and session handling are pi-repl's own code. agent-repl adds an MCP server and a command-line interface in place of Pi's extension API.

Here Claude Code defined `f` and printed two values, and Codex, started separately, then called the same `f`. This is the Python session's tmux pane, with the paths of the private files that carry each submission shortened:

```text
>>> exec(open("/tmp/pi-rc-…/c9749e010f41-….py").read(),globals())

── pi-repl · input · 5 lines · id: c9749e010f41 ──
def f(n):
    return sum(i*i for i in range(1, n+1))
print(f(10))
print(f(100))
── output ──
385
338350
── done · id: c9749e010f41 ──

>>> exec(open("/tmp/pi-rc-…/7dacd8658f42-….py").read(),globals())

── pi-repl · input · 1 line · id: 7dacd8658f42 ──
print(f(1000))
── output ──
333833500
── done · id: 7dacd8658f42 ──

>>>
```

## Features

- **Shared sessions**: each runtime has one named tmux session (`pi-repl-python`, `pi-repl-julia`, ...), used by you, Pi and every connected agent. An agent sees variables you defined in the terminal, and you see what the agent ran.
- **MCP tools**: `repl_start`, `repl_status` and `repl_send`, with pi-repl's descriptions and guidance for each runtime.
- **Command line**: start, attach to, inspect, export and stop sessions from a terminal.
- **Labelled submissions**: code sent by an agent appears in the pane with its output between labelled markers, as above. How much code is shown can be changed (see [Echo setting](#echo-setting)).
- **Records**: pi-repl keeps a raw log of each session's pane and a clean record of submitted code and output, which can be exported as Markdown. A compatible [pi-studio](https://github.com/omaclaren/pi-studio) using the same session shares the clean record.

## Requirements

- Node.js 22 or later
- [tmux](https://github.com/tmux/tmux)
- The runtimes you want to use, available as commands in your login shell: `python` or `ipython`, `julia`, `R`, `ghci`, `clojure`, `irb`, `jshell`, `octave-cli`, `matlab`, `gnuplot` or `cling`

agent-repl is developed and tested on macOS. pi-repl also supports Linux, and Windows through WSL.

## Install

agent-repl is not on npm yet. From a clone:

```bash
git clone https://github.com/omaclaren/agent-repl
cd agent-repl
npm install
npm run build
npm link            # puts the agent-repl command on your PATH
```

## Setting up an agent

Each agent starts `agent-repl mcp` itself when it needs the tools. Add it once:

**Claude Code**

```bash
claude mcp add --scope user agent-repl -- agent-repl mcp
```

**Codex**

```bash
codex mcp add agent-repl -- agent-repl mcp
```

**OpenCode**: in `~/.config/opencode/opencode.json`, or `opencode.json` in a project:

```json
{
  "mcp": {
    "agent-repl": { "type": "local", "command": ["agent-repl", "mcp"], "enabled": true }
  }
}
```

**Other agents**: configure a stdio MCP server with the command `agent-repl` and the argument `mcp`.

Then ask the agent, for example, to "start a shared Julia REPL and fit a line to these points", and run `agent-repl attach julia` in a terminal to follow along. Claude Code and Codex have both run code in a shared Python session this way; OpenCode connects to the server and lists its tools.

New sessions start in the MCP server's working directory, which is wherever the agent launches it; `agent-repl mcp --cwd <dir>` sets it explicitly. An existing session keeps the directory it started in.

## Command line

| Command | Description |
|---------|-------------|
| `agent-repl <runtime>` | Start or reuse a shared REPL and attach to it in this terminal |
| `agent-repl <runtime> -d` | Start or reuse a shared REPL without attaching |
| `agent-repl status [runtime]` | Show running sessions |
| `agent-repl attach [runtime]` | Attach to a session in this terminal |
| `agent-repl env [python]` | Show the Python session's interpreter and environment |
| `agent-repl export [runtime]` | Write the session's clean record to a Markdown file in the current directory |
| `agent-repl stop [runtime]` | Stop a session, verifying that its processes exit |
| `agent-repl mcp [--cwd <dir>]` | Run the MCP server on stdio |

Runtimes are `python`, `ipython`, `julia`, `r`, `ghci`, `clojure` (or `clj`), `ruby`, `java`, `octave`, `matlab`, `gnuplot` and `cpp`. Python and IPython share one session. Without a runtime, `status` lists every session, and `attach`, `export` and `stop` act on the only running session.

`attach` runs `tmux attach` in the current terminal, or switches the current client when you are already inside tmux. Without a terminal, for example when an agent runs the command, it prints the `tmux attach` command instead.

These are pi-repl's `/repl` commands, and the output is pi-repl's. The [pi-repl README](https://github.com/omaclaren/pi-repl#readme) describes them in detail, including how `stop` checks that a runtime has exited and how each runtime handles submitted code.

## Tools

| Tool | Description |
|------|-------------|
| `repl_start` | Start or reuse a session with an explicit runtime and wait for a normal prompt |
| `repl_status` | Report which sessions are running, with their paths and recent output |
| `repl_send` | Run code in a running session and return the submitted code and output |

`repl_send` never starts a session, and stopping one is left to you. The tool descriptions are pi-repl's, with its guidance for agents appended. Claude Code limits an MCP tool description to 2,048 characters, so guidance about choosing a runtime, and the notes for particular runtimes, are attached to the `target` parameter instead. Arguments are checked against pi-repl's parameter schemas, as Pi checks them, before a tool runs.

## Echo setting

By default an agent's submissions are shown in the pane in summary form: short code in full, longer code truncated. Each MCP server has its own setting, taken from `PI_REPL_ECHO_MODE` (`off`, `summary` or `full`) when it starts:

```bash
claude mcp add --scope user -e PI_REPL_ECHO_MODE=off agent-repl -- agent-repl mcp
```

An agent can also pass `echoMode` for a single `repl_send`. Full mode keeps longer source code in the pane's history.

## Privacy and safety

An agent's code runs in your REPL with your permissions. Whether the agent asks before calling a tool is decided by the agent's own permission settings. Anyone who can reach your tmux server can see and type into these sessions.

pi-repl writes submitted code to private temporary files (mode `0600`, in a directory only you can read) and removes them after each run. The raw session log and the clean record are kept in similar private directories under your temporary directory. The log is not deleted automatically; the clean record keeps the most recent 300 submissions. `PI_REPL_CONTROL_ROOT` moves the temporary code files to another directory, which must be owned by you with mode `0700`.

## Relationship to pi-repl

`src/pi-repl.ts` is generated from pi-repl's `index.ts` and should not be edited by hand. The only change is where its two Pi imports come from: `src/pi-compat` holds copies of the Pi helpers it uses (output truncation, command execution and `StringEnum`, MIT licensed, © Mario Zechner) and type definitions for the parts of Pi's extension API it calls. `src/shared` is pi-repl's `shared/` directory, unchanged. `src/host.ts` provides that API, and `src/mcp.ts` and `src/cli.ts` expose the tools and the `/repl` command.

With a pi-repl checkout beside this one, after running `npm install` there:

```bash
npm run sync        # regenerate src/pi-repl.ts, src/shared, src/pi-compat and test/upstream
npm run test:all
```

pi-repl's own test suite is copied to `test/upstream` with only its import paths changed, and runs against the generated copy with `npm run test:upstream`. Tests for optional runtimes are skipped unless `PI_REPL_TEST_RUNTIMES` selects them, as in pi-repl.

Two things behave differently outside Pi. The echo setting belongs to each MCP server process, so `agent-repl echo` only explains how to set it. Clean-record entries keep pi-repl's labels, so submissions from any agent are labelled `Pi`.

## Development

```bash
npm install
npm test               # builds, then runs the unit and end-to-end tests
npm run test:upstream  # pi-repl's test suite against the generated copy
npm run typecheck
```

The end-to-end tests start `agent-repl mcp` and the command line against a real Python REPL. They use a separate tmux server with its own socket, a temporary home directory and private temporary files, so they never touch your sessions. They are skipped when tmux or `python3` is not available.

## License

MIT
