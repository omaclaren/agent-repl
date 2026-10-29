import test from "node:test";
import assert from "node:assert/strict";
import { forAgentRepl, forAgentReplOutsideFences } from "../dist/text.js";

test("pi-repl's command wording becomes agent-repl, without the /lab alias", () => {
	const cases = [
		["Start one with /repl julia or /lab julia.", "Start one with agent-repl julia."],
		["Start one with /repl R or /repl r, or /lab R or /lab r.", "Start one with agent-repl R or agent-repl r."],
		["Start one with /repl clojure or /repl clj, or /lab clojure or /lab clj.", "Start one with agent-repl clojure or agent-repl clj."],
		["Start one with /repl python, /repl ipython, /lab python, or /lab ipython.", "Start one with agent-repl python, agent-repl ipython."],
		["started with repl_start, /repl, or /lab and is at a normal prompt", "started with repl_start or agent-repl and is at a normal prompt"],
		["It uses the same startup path as /repl and /lab; Python and IPython", "It uses the same startup path as agent-repl; Python and IPython"],
		["For R, both /repl R and /repl r work. The same applies to /lab, /repl status, and /repl stop.", "For R, both agent-repl R and agent-repl r work. The same applies to agent-repl status, and agent-repl stop."],
		["  /repl echo [off|summary|full]", "  agent-repl echo [off|summary|full]"],
		["Unknown /repl subcommand or runtime: x", "Unknown agent-repl subcommand or runtime: x"],
		["Dot commands are terminal-only; use /repl stop cpp to stop.", "Dot commands are terminal-only; use agent-repl stop cpp to stop."],
		["tmux was not found on PATH. pi-repl requires tmux.", "tmux was not found on PATH. agent-repl requires tmux."],
		["Respect the current /repl echo setting; use echoMode='off'", "Respect the server's echo setting; use echoMode='off'"],
		["Stop it with /repl stop lfortran (agent-repl stop lfortran outside Pi).", "Stop it with agent-repl stop lfortran."],
		["To answer it from here: /repl input <text>", "To answer it from here: agent-repl input <text>"],
		["Nothing to send. Usage: /repl send [runtime], with the code on the lines below it (Shift+Enter starts a new line).", "Nothing to send. Usage: agent-repl send lfortran, with the code on stdin."],
	];
	for (const [input, expected] of cases) assert.equal(forAgentRepl(input), expected);
});

test("session names, paths and other text are unchanged", () => {
	for (const text of [
		"Session: pi-repl-python",
		"tmux attach -t pi-repl-julia",
		"Raw history log: /tmp/pi-repl-history-501/pi-repl-python.log",
		"Path: /Users/someone/repl/project",
		"Path: /repl/x",
		"cd /labs/data && ls /lab/",
		"sessions (pi-repl-python, pi-repl-julia)",
	]) assert.equal(forAgentRepl(text), text);
});

test("a command's fenced result keeps its code and output as they are", () => {
	const result = "/repl send to pi-repl-python:\n\n```\nprint(\"/lab python\")\n/repl python\n```\nStart one with /repl julia or /lab julia.";
	assert.equal(forAgentReplOutsideFences(result),
		"agent-repl send to pi-repl-python:\n\n```\nprint(\"/lab python\")\n/repl python\n```\nStart one with agent-repl julia.");
	// A longer fence holds shorter ones, and an unclosed fence keeps the rest.
	assert.equal(forAgentReplOutsideFences("````\n```\n/repl x\n```\n````\n/repl y"), "````\n```\n/repl x\n```\n````\nagent-repl y");
	assert.equal(forAgentReplOutsideFences("```\n/repl x"), "```\n/repl x");
	assert.equal(forAgentReplOutsideFences("Use /repl stop python."), "Use agent-repl stop python.");
});
