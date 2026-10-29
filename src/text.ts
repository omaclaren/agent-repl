// pi-repl's messages and tool guidance refer to its Pi commands, /repl and its
// alias /lab. Outside Pi the same actions are `agent-repl ...` in a terminal.
// This rewrites that wording in tool descriptions and command output. It is
// never applied to REPL output.

const PHRASES: [string, string][] = [
	["current /repl echo setting", "server's echo setting"],
	["repl_start, /repl, or /lab", "repl_start or agent-repl"],
	["the same startup path as /repl and /lab", "the same startup path as agent-repl"],
	["The same applies to /lab, ", "The same applies to "],
	["pi-repl requires tmux", "agent-repl requires tmux"],
	["/repl stop lfortran (agent-repl stop lfortran outside Pi)", "agent-repl stop lfortran"],
	// /repl send takes its code from the lines below it; agent-repl send takes it from stdin.
	// agent-repl send takes only lfortran for now (see cli.ts).
	["/repl send [runtime], with the code on the lines below it (Shift+Enter starts a new line).", "/repl send lfortran, with the code on stdin."],
	["/repl send [runtime], with the code on the lines below it", "/repl send lfortran, with the code on stdin"],
	["/repl send [runtime] sends the code on the lines below it to that running session (Python by default), as repl_send does; its result goes into the conversation, where the agent sees it too. Shift+Enter starts a new line",
		"/repl send lfortran sends the code on stdin to the LFortran session, as repl_send does, and prints the result"],
];

// "/repl julia or /lab julia", "/repl R or /repl r, or /lab R or /lab r",
// "/repl python, /repl ipython, /lab python, or /lab ipython": drop the /lab forms.
const LAB_ALTERNATIVES = /(?:,? or |, | and )\/lab(?: (?!and\b|or\b)[\w${}]+)?(?:,? or \/lab(?: [\w${}]+)?)*/g;
const COMMAND = /(^|[\s"'`(])\/(?:repl|lab)(?=[\s.,;:)"'`]|$)/gm;

export function forAgentRepl(text: string): string {
	for (const [from, to] of PHRASES) text = text.split(from).join(to);
	return text.replace(LAB_ALTERNATIVES, "").replace(COMMAND, "$1agent-repl");
}

/**
 * forAgentRepl for a command's output, except in its fenced blocks: pi-repl
 * puts a send's result there, and a REPL's code and output stay as they are.
 */
export function forAgentReplOutsideFences(text: string): string {
	const parts: string[] = [];
	let prose: string[] = [];
	let fence: string | undefined;
	for (const line of text.split("\n")) {
		if (fence === undefined && /^`{3,}$/.test(line)) {
			if (prose.length) parts.push(forAgentRepl(prose.join("\n")));
			prose = [];
			fence = line;
			parts.push(line);
		} else if (fence !== undefined) {
			parts.push(line);
			if (line === fence) fence = undefined;
		} else {
			prose.push(line);
		}
	}
	if (prose.length) parts.push(forAgentRepl(prose.join("\n")));
	return parts.join("\n");
}
