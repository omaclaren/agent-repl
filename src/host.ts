// Runs pi-repl outside Pi. pi-repl registers its tools and its /repl command
// through a small part of Pi's extension API; this supplies that part, with
// commands run by Pi's own execCommand (copied in pi-compat).
import registerPiRepl from "./pi-repl.js";
import { execCommand, type CommandDefinition, type ExtensionAPI, type ExtensionContext, type ToolDefinition } from "./pi-compat/index.js";

export type Level = "info" | "warning" | "error";

export interface PiReplHost {
	tools: Map<string, ToolDefinition>;
	commands: Map<string, CommandDefinition>;
}

let host: PiReplHost | undefined;

/** pi-repl keeps its state in module variables, so it is registered once per process. */
export function loadPiRepl(): PiReplHost {
	if (host) return host;
	const tools = new Map<string, ToolDefinition>();
	const commands = new Map<string, CommandDefinition>();
	const api: ExtensionAPI = {
		exec: (command, args, options) => execCommand(command, args, options?.cwd ?? process.cwd(), options),
		registerTool: tool => { tools.set(tool.name, tool as unknown as ToolDefinition); },
		registerCommand: (name, command) => { commands.set(name, command); },
	};
	registerPiRepl(api);
	host = { tools, commands };
	return host;
}

export function hostContext(cwd: string, notify: (message: string, level: Level) => void): ExtensionContext {
	return { cwd, hasUI: true, ui: { notify: (message, level = "info") => notify(message, level) } };
}
