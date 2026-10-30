import { resolve } from "node:path";

/**
 * agent-repl's arguments and working directory. `--cwd` is recognised before
 * `--`, and not in an `input` command's answer or a `send` command's `-c` or
 * `-f` value, which are passed on as given.
 */
export function splitArgs(argv: string[], cwd: string): { cwd: string; args: string[] } {
	const args: string[] = [];
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];
		if (args[0]?.toLowerCase() === "input") { args.push(...argv.slice(index)); break; }
		if (arg === "--") { args.push(...argv.slice(index + 1)); break; }
		if (args[0]?.toLowerCase() === "send" && (arg === "-c" || arg === "-f")) { args.push(...argv.slice(index, index + 2)); index++; continue; }
		if (arg === "--cwd") cwd = resolve(argv[++index] ?? ".");
		else if (arg.startsWith("--cwd=")) cwd = resolve(arg.slice("--cwd=".length));
		else args.push(arg);
	}
	return { cwd, args };
}
