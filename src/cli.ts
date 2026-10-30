#!/usr/bin/env node
// agent-repl: pi-repl's shared tmux REPLs for any coding agent.
//
//   agent-repl mcp            MCP server on stdio, for an agent's MCP configuration
//   agent-repl <args>         pi-repl's /repl command in a terminal, e.g. `agent-repl python`
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { splitArgs } from "./args.js";
import { attachArgs } from "./attach.js";
import { hostContext, loadPiRepl, type Level } from "./host.js";
import { runMcpServer } from "./mcp.js";
import { CancelledSend, envSettled, parseSendArgs, readCode, SendRefused, sendFromStdin, type SettledResult } from "./send.js";
import { forAgentReplOutsideFences } from "./text.js";

const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

const HELP = `agent-repl ${VERSION}: shared tmux REPLs for coding agents, from pi-repl

Usage:
  agent-repl mcp [--cwd <dir>]   Run the MCP server on stdio (add this to your agent)
  agent-repl <runtime> [-d]      Start or reuse a shared REPL and attach to it (-d: start only)
  agent-repl status [runtime]    Show running sessions
  agent-repl attach [runtime]    Open a session in this terminal
  agent-repl env [python]        Show the Python session's interpreter and environment
  agent-repl send [runtime]      Run code from stdin in a running session, and wait until it's done
  agent-repl input <text>        Answer the READ an LFortran cell from agent-repl waits on
  agent-repl name [name|--clear] Show, set or clear the name your sends are recorded under
  agent-repl export [runtime]    Write the session's record of submissions to a file
  agent-repl stop [runtime]      Stop a session

Runtimes: python, ipython, julia, r, ghci, clojure (clj), ruby, java, octave,
matlab, gnuplot, cpp, and lfortran (experimental; needs LFortran's main
branch). Sessions are the tmux sessions pi-repl uses (pi-repl-python,
pi-repl-julia, ...), shared by every agent and terminal.

agent-repl send waits however long the code runs, so that its output is recorded
and no other send takes it. --notice <seconds> (default 20) says when to report
that it's still running; --lease-wait <seconds> (default 60) is how long to wait
for another send to finish first. Ctrl-C before the code is sent cancels; after,
the first press keeps waiting, and a second stops waiting, which is unsafe.

Environment:
  PI_REPL_ECHO_MODE     off, summary (default) or full: how much submitted code
                        the MCP server echoes into the REPL pane
  PI_REPL_AGENT_LABEL   name recorded for an agent's submissions (default: the
                        agent's own name, such as Claude Code or Codex)
  PI_REPL_USER_NAME     name recorded for your own sends, over agent-repl name's
  PI_REPL_CONTROL_ROOT  directory for the private files used to submit code`;

const SUBCOMMANDS = new Set(["status", "env", "stop", "attach", "export", "echo", "help", "input", "name"]);

/** Prints a settled send's result, or why it wasn't sent; Ctrl-C before sending exits 130. */
async function printSettled(run: () => Promise<SettledResult>): Promise<void> {
	try {
		const result = await run();
		console.log(forAgentReplOutsideFences(result.text));
		process.exitCode = result.exitCode;
	} catch (error) {
		console.error(forAgentReplOutsideFences(error instanceof Error ? error.message : String(error)));
		process.exitCode = error instanceof CancelledSend ? 130 : 1;
	}
}

const notifyStderr = (message: string) => console.error(forAgentReplOutsideFences(message));

interface Captured { message: string; level: Level }

async function runReplCommand(args: string, cwd: string, print: boolean): Promise<Captured[]> {
	const captured: Captured[] = [];
	const notify = (message: string, level: Level) => {
		captured.push({ message, level });
		if (!print) return;
		const text = forAgentReplOutsideFences(message);
		if (level === "info") console.log(text);
		else console.error(text);
		if (level === "error") process.exitCode = 1;
	};
	await loadPiRepl().commands.get("repl")!.handler(args, hostContext(cwd, notify));
	return captured;
}

/** The session named by pi-repl's attach instructions, when there is exactly one. */
export function attachTarget(messages: Captured[]): string | undefined {
	const names = messages.flatMap(({ message }) => [...message.matchAll(/^tmux attach -t (\S+)$/gm)].map(match => match[1]));
	return names.length === 1 ? names[0] : undefined;
}

function attachTerminal(sessionName: string): number {
	return spawnSync("tmux", attachArgs(sessionName, Boolean(process.env.TMUX)), { stdio: "inherit" }).status ?? 1;
}

async function attach(runtime: string, cwd: string): Promise<void> {
	const interactive = process.stdin.isTTY && process.stdout.isTTY;
	const messages = await runReplCommand(`attach ${runtime}`.trim(), cwd, !interactive);
	const target = attachTarget(messages);
	if (interactive && target) process.exitCode = attachTerminal(target);
	else if (interactive) for (const { message, level } of messages) (level === "info" ? console.log : console.error)(forAgentReplOutsideFences(message));
}

async function main(argv: string[]): Promise<void> {
	const { cwd, args } = splitArgs(argv, process.cwd());
	const [first = "", ...rest] = args;
	const command = first.toLowerCase();

	if (!first || command === "help" || first === "--help" || first === "-h") { console.log(HELP); return; }
	if (first === "--version" || first === "-v") { console.log(VERSION); return; }
	if (command === "mcp") { await runMcpServer({ cwd, version: VERSION }); return; }
	if (command === "echo") {
		console.log("The echo setting belongs to each agent's agent-repl MCP server. Set PI_REPL_ECHO_MODE=off, summary or full in the server's environment, or ask the agent to pass echoMode to repl_send.");
		return;
	}
	if (command === "attach") { await attach(rest.join(" "), cwd); return; }
	if (command === "send") {
		// pi-repl's /repl send takes the code from the lines below the command; here it comes from stdin.
		if (process.stdin.isTTY) {
			console.error("Pipe the code in, for example: echo 'print(1)' | agent-repl send python");
			process.exitCode = 1;
			return;
		}
		// LFortran's helper matches output to cells and goes on recording a cell after its sender stops waiting.
		if (rest[0]?.toLowerCase() === "lfortran") {
			await runReplCommand(`send ${rest.join(" ")}\n${readFileSync(0, "utf8")}`, cwd, true);
			return;
		}
		await printSettled(async () => {
			const sendArgs = parseSendArgs(rest);
			return sendFromStdin(cwd, sendArgs, await readCode(process.stdin), notifyStderr);
		});
		return;
	}
	if (command === "env" && (rest.length === 0 || /^i?python$/i.test(rest[0]) && rest.length === 1)) {
		await printSettled(() => envSettled(cwd, notifyStderr));
		return;
	}
	if (SUBCOMMANDS.has(command)) { await runReplCommand(args.join(" "), cwd, true); return; }

	// Anything else is a start request, which pi-repl parses and validates.
	const detach = rest.some(arg => arg === "-d" || arg === "--detach");
	const startArgs = args.filter(arg => arg !== "-d" && arg !== "--detach").join(" ");
	const messages = await runReplCommand(startArgs, cwd, true);
	if (process.exitCode || detach || messages.some(({ level }) => level !== "info")) return;
	if (process.stdin.isTTY && process.stdout.isTTY) await attach(first, cwd);
}

main(process.argv.slice(2)).catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
