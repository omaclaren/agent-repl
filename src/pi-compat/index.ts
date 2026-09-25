// Structural stand-ins for the parts of Pi's extension API that pi-repl uses,
// plus MIT-licensed copies of the Pi helpers it imports (see the other files
// here). Pi's own ExtensionAPI and contexts satisfy these types, so pi-repl's
// source compiles unchanged against either.
import type { Static, TSchema } from "typebox";
import type { ExecOptions, ExecResult } from "./exec.js";

export { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead, truncateTail, type TruncationResult } from "./truncate.js";
export { StringEnum } from "./string-enum.js";
export { execCommand, type ExecOptions, type ExecResult } from "./exec.js";

export interface ExtensionContext {
	cwd: string;
	hasUI: boolean;
	ui: { notify(message: string, level?: "info" | "warning" | "error"): void };
}
export type ExtensionCommandContext = ExtensionContext;

export interface AgentToolResult<TDetails = unknown> {
	content: { type: "text"; text: string }[];
	details?: TDetails;
}

export interface ToolDefinition<TParams extends TSchema = TSchema, TDetails = unknown> {
	name: string;
	label: string;
	description: string;
	promptSnippet?: string;
	promptGuidelines?: string[];
	parameters: TParams;
	execute(toolCallId: string, params: Static<TParams>, signal: AbortSignal | undefined,
		onUpdate: ((update: AgentToolResult<TDetails>) => void) | undefined, ctx: ExtensionContext): Promise<AgentToolResult<TDetails>>;
}

export interface CommandDefinition {
	description?: string;
	handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
	getArgumentCompletions?: (prefix: string) => unknown;
}

export interface ExtensionAPI {
	exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
	registerTool<TParams extends TSchema = TSchema, TDetails = unknown>(tool: ToolDefinition<TParams, TDetails>): void;
	registerCommand(name: string, options: CommandDefinition): void;
}
