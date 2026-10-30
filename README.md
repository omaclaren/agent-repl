# agent-repl

Shared REPL sessions for coding agents. agent-repl starts a Python, IPython, Julia, R, Haskell (GHCi), Clojure, Ruby, Java, Octave, MATLAB, gnuplot or C++ REPL, or an experimental LFortran session, in tmux. You attach to it from a terminal and work there as normal. [Claude Code](https://docs.claude.com/en/docs/claude-code), [Codex](https://github.com/openai/codex), [OpenCode](https://opencode.ai) and other agents that support MCP run code in the same session, so you and the agent share one live workspace.

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
- **MCP tools**: `repl_start`, `repl_status`, `repl_send` and `repl_input`, with pi-repl's descriptions and guidance for each runtime.
- **Command line**: start, attach to, inspect, export and stop sessions from a terminal.
- **Labelled submissions**: code sent by an agent appears in the pane with its output between labelled markers, as above. How much code is shown can be changed (see [Echo setting](#echo-setting)).
- **Records**: pi-repl keeps a raw log of each session's pane and a clean record of submitted code and output, which can be exported as Markdown. Each entry in the record names the agent that sent it. A compatible [pi-studio](https://github.com/omaclaren/pi-studio) using the same session shares the clean record.

## Requirements

- Node.js 22 or later
- [tmux](https://github.com/tmux/tmux)
- The runtimes you want to use, available as commands in your login shell: `python` or `ipython`, `julia`, `R`, `ghci`, `clojure`, `irb`, `jshell`, `octave-cli`, `matlab`, `gnuplot`, `cling`, or `lfortran` built from LFortran's `main` branch

agent-repl is an early release, developed and tested on macOS. pi-repl also supports Linux, and Windows through WSL.

## Install

```bash
npm install -g agent-repl
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
    "agent-repl": {
      "type": "local",
      "command": ["agent-repl", "mcp"],
      "environment": { "PI_REPL_AGENT_LABEL": "OpenCode" },
      "enabled": true
    }
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
| `agent-repl send [runtime] [-c <code> \| -f <file>]` | Run your own code in a running session, wait until it's done, and print the result |
| `agent-repl input <text>` | Answer the READ that an LFortran cell sent through agent-repl is waiting on |
| `agent-repl name [name\|--clear]` | Show, set or clear the name your own sends are recorded under |
| `agent-repl export [runtime]` | Write the session's clean record to a Markdown file in the current directory |
| `agent-repl stop [runtime]` | Stop a session, verifying that its processes exit |
| `agent-repl mcp [--cwd <dir>]` | Run the MCP server on stdio |

Runtimes are `python`, `ipython`, `julia`, `r`, `ghci`, `clojure` (or `clj`), `ruby`, `java`, `octave`, `matlab`, `gnuplot`, `cpp` and, experimentally, `lfortran`. Python and IPython share one session. Without a runtime, `status` lists every session, and `attach`, `export` and `stop` act on the only running session.

`send` runs your own code, as `repl_send` runs an agent's: `agent-repl send python -c 'print(df.head())'` for a line, `agent-repl send julia -f script.jl` for a file's text, or code piped in or from a heredoc. `-c` takes the code as one argument, even when it starts with `-`; for several lines, end the `-c` line with the opening `'`, put the code on the lines below, and close the `'` on a line of its own (the blank line before the code isn't sent). `-c` leaves the code in your shell history and process listings, so use `-f` or stdin for anything sensitive. `-f` reads the file relative to `--cwd` when that's given, and `-f -` reads stdin. With `-c` or `-f`, stdin isn't read, so they work from an agent's shell mode, such as Claude Code's `!`. It waits however long the code runs, so that the output is recorded as this send's and no other send can take it; after 20 seconds (`--notice <seconds>`) it says the code is still running. If another send has the session, it waits up to 60 seconds (`--lease-wait <seconds>`) for it to finish, and gives up without sending. Ctrl-C before the code is sent cancels it. Once it is sent, the first Ctrl-C keeps waiting, and a second stops waiting, which is unsafe: after 30 seconds another send may record the code's late output. `send` sends nothing it can't record, and refuses empty code, invalid UTF-8, and code over 200,000 characters, which the record couldn't keep whole. `env` waits the same way. `send lfortran` goes through LFortran's helper, which matches output to cells, so it needs none of this.

`attach` runs `tmux attach` in the current terminal, or switches the current client when you are already inside tmux. Without a terminal, for example when an agent runs the command, it prints the `tmux attach` command instead.

These are pi-repl's `/repl` commands, and the output is pi-repl's. The [pi-repl README](https://github.com/omaclaren/pi-repl#readme) describes them in detail, including how `stop` checks that a runtime has exited and how each runtime handles submitted code.

## Tools

| Tool | Description |
|------|-------------|
| `repl_start` | Start or reuse a session with an explicit runtime and wait for a normal prompt |
| `repl_status` | Report which sessions are running, with their paths and recent output |
| `repl_send` | Run code in a running session and return the submitted code and output, after any pane text the agent hasn't seen |
| `repl_input` | Answer the READ that an LFortran cell sent by `repl_send` is waiting on |

When code outlasts `repl_send`'s wait, the tool returns, but the code goes on: the MCP server keeps the session for it, records its output when it finishes, and the result tells the agent not to send it again. `agent-repl status` shows which send holds a session. When its client disconnects, the server waits for such sends before it exits, saying so on stderr. A client that kills it sooner (the MCP SDK allows about four seconds) leaves that send without an owner; its lease then goes stale after 30 seconds, and a later send may record the code's late output.

`repl_send` never starts a session, and stopping one is left to you. The tool descriptions are pi-repl's, with its guidance for agents appended. Claude Code limits an MCP tool description to 2,048 characters, so guidance about choosing a runtime, and the notes for particular runtimes, are attached to the `target` parameter instead. Arguments are checked against pi-repl's parameter schemas, as Pi checks them, before a tool runs.

## LFortran (experimental)

`agent-repl lfortran`, or `repl_start` with `runtime: "lfortran"`, starts LFortran's shared session, `pi-repl-lfortran`. It needs a build of LFortran's `main` branch, found as `lfortran` by your login shell. You work at LFortran's own prompt in the session's first window. The agent's cells go to the same kernel through pi-repl's helper in the second, so you share one set of variables, and your prompt shows the agent's cells when you next press Enter there.

When one of the agent's cells waits on a READ, the agent answers it with `repl_input`, or you can answer it yourself with `agent-repl input <text>`. The cells sent through agent-repl, the agent's and `agent-repl send lfortran`'s, are in the session's clean record, as the other runtimes' sends are, and `agent-repl export lfortran` writes it as Markdown. The cells you run at your prompt aren't recorded, and unlike the other runtimes, the agent isn't told about them and echo settings don't apply. The [pi-repl README](https://github.com/omaclaren/pi-repl#lfortran-sessions-experimental) describes the session and LFortran's current limits.

## Echo setting

By default an agent's submissions are shown in the pane in summary form: short code in full, longer code truncated. Each MCP server has its own setting, taken from `PI_REPL_ECHO_MODE` (`off`, `summary` or `full`) when it starts:

```bash
claude mcp add --scope user -e PI_REPL_ECHO_MODE=off agent-repl -- agent-repl mcp
```

An agent can also pass `echoMode` for a single `repl_send`. Full mode keeps longer source code in the pane's history.

## Agent names in the record

Your own sends, from `agent-repl send` and `env`, are recorded under your name: the one `agent-repl name` saves for your account, which `PI_REPL_USER_NAME` overrides, or `User` when neither is set. Pi's `/repl name` sets the same saved name.

Entries in the clean record, and in `agent-repl export`, are labelled with the name the agent gives when it connects: `Claude Code` and `Codex` name themselves, and other agents are labelled with whatever name they send. To choose the label yourself, set `PI_REPL_AGENT_LABEL` in the server's environment, as for the echo setting. OpenCode 2 identifies itself only as `cli`, so the OpenCode configuration above sets the label. Submissions from Pi are labelled `Pi`.

## What you type in a session

`repl_send` tells the agent what appeared in the pane since its own last send, before its new code: what you typed at the prompt, other agents' or Pi's sends, and output that arrived later. Its first send to a session it hasn't seen shows the pane's recent text, and `repl_status` previews the same text. These reports are bounded, are labelled as untrusted terminal text, and never enter the clean record.

That text, including anything you type, reaches the agent and its model provider. To stop it, set `PI_REPL_PANE_ACTIVITY=off` in the server's environment, as for the echo setting. In Pi, pi-repl also adds this text when a run starts, before the model plans; an MCP server can't do that, so here `on` (the default) and `send` both report only in send results. It stops reports while it is set but does not erase the pane's history. The MCP server can't tell when an agent clears or compacts its own context, so after that the agent may lack pane text it was shown before.

## Privacy and safety

An agent's code runs in your REPL with your permissions, and it is shown what you type in a session (see above). Whether the agent asks before calling a tool is decided by the agent's own permission settings. Anyone who can reach your tmux server can see and type into these sessions.

pi-repl writes submitted code to private temporary files (mode `0600`, in a directory only you can read) and removes them after each run. The raw session log and the clean record are kept in similar private directories under your temporary directory. The log is not deleted automatically; the clean record keeps the most recent 300 submissions. `PI_REPL_CONTROL_ROOT` moves the temporary code files to another directory, which must be owned by you with mode `0700`.

## Relationship to pi-repl

`src/pi-repl.ts` is generated from pi-repl's `index.ts` and should not be edited by hand. The only change is where its Pi imports come from: `src/pi-compat` holds copies of the Pi helpers it uses (output truncation, command execution, `StringEnum` and pi-tui's `stripTerminalSequences`, MIT licensed, © Mario Zechner), type definitions for the parts of Pi's extension API it calls, and stand-ins for pi-tui's `Box` and `Text`. pi-repl draws its Pi messages with those; agent-repl draws none, and the stand-ins let pi-repl's tests of those messages run. `src/shared` is pi-repl's `shared/` directory, unchanged. `src/host.ts` provides that API, and `src/mcp.ts` and `src/cli.ts` expose the tools and the `/repl` command.

With a pi-repl checkout beside this one, after running `npm install` there:

```bash
npm run sync        # regenerate src/pi-repl.ts, src/shared, src/pi-compat and test/upstream
npm run test:all
```

pi-repl's own test suite is copied to `test/upstream` with only its import paths changed, and runs against the generated copy with `npm run test:upstream`. Tests for optional runtimes are skipped unless `PI_REPL_TEST_RUNTIMES` selects them, as in pi-repl.

The echo setting behaves differently outside Pi: it belongs to each MCP server process, so `agent-repl echo` only explains how to set it.

## Development

```bash
git clone https://github.com/omaclaren/agent-repl
cd agent-repl
npm install
npm link               # use this checkout as the agent-repl command
npm test               # builds, then runs the unit and end-to-end tests
npm run test:upstream  # pi-repl's test suite against the generated copy
npm run typecheck
```

The end-to-end tests start `agent-repl mcp` and the command line against a real Python REPL. They use a separate tmux server with its own socket, a temporary home directory and private temporary files, so they never touch your sessions. They are skipped when tmux or `python3` is not available. The LFortran test runs only when `PI_REPL_LFORTRAN` names an `lfortran` built from LFortran's `main` branch.

## License

MIT. The files in `src/pi-compat` copied from Pi are MIT licensed, © 2025 Mario Zechner; see [`src/pi-compat/LICENSE`](src/pi-compat/LICENSE).
