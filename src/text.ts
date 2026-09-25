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
];

// "/repl julia or /lab julia", "/repl R or /repl r, or /lab R or /lab r",
// "/repl python, /repl ipython, /lab python, or /lab ipython": drop the /lab forms.
const LAB_ALTERNATIVES = /(?:,? or |, | and )\/lab(?: (?!and\b|or\b)[\w${}]+)?(?:,? or \/lab(?: [\w${}]+)?)*/g;
const COMMAND = /(^|[\s"'`(])\/(?:repl|lab)(?=[\s.,;:)"'`]|$)/gm;

export function forAgentRepl(text: string): string {
	for (const [from, to] of PHRASES) text = text.split(from).join(to);
	return text.replace(LAB_ALTERNATIVES, "").replace(COMMAND, "$1agent-repl");
}
