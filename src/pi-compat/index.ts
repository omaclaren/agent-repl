// Structural stand-ins for the parts of Pi's extension API that pi-repl uses,
// plus MIT-licensed copies of the Pi helpers it imports (see the other files
// here). Pi's own ExtensionAPI and contexts satisfy these types, so pi-repl's
// source compiles unchanged against either.
import type { Static, TSchema } from "typebox";
import type { ExecOptions, ExecResult } from "./exec.js";
import type { Component } from "./tui.js";

export { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead, truncateTail, type TruncationResult } from "./truncate.js";
export { StringEnum } from "./string-enum.js";
export { execCommand, type ExecOptions, type ExecResult } from "./exec.js";
export { stripTerminalSequences } from "./ansi.js";
export { Box, Text, type Component } from "./tui.js";

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

export interface MessageTheme {
	fg(color: string, text: string): string;
	bg(color: string, text: string): string;
	bold(text: string): string;
}

export interface CustomMessage {
	customType: string;
	content: string;
	display: boolean;
	details?: unknown;
}

export type MessageRenderer = (message: CustomMessage, options: { expanded: boolean; outputPad: number }, theme: MessageTheme) => Component | undefined;

export interface ExtensionAPI {
	exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
	registerTool<TParams extends TSchema = TSchema, TDetails = unknown>(tool: ToolDefinition<TParams, TDetails>): void;
	registerCommand(name: string, options: CommandDefinition): void;
	// Pi's conversation and run events. agent-repl's host has none: one MCP
	// server serves one agent conversation, and nothing is added at run start.
	on?(event: string, handler: (event: unknown, ctx: ExtensionContext) => unknown): void;
	// Messages in Pi's conversation. agent-repl's host has none: pi-repl shows a
	// command's result as a notice instead, and the renderer it registers is unused.
	sendMessage?(message: CustomMessage, options?: { triggerTurn?: boolean }): void;
	registerMessageRenderer(customType: string, renderer: MessageRenderer): void;
}
