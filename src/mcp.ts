// MCP server exposing pi-repl's tools (repl_start, repl_status, repl_send).
//
// Pi shows a tool's description to the model and adds its prompt guidelines to
// the system prompt. MCP has only the description, and some clients cap it
// (Claude Code at 2,048 characters), so general guidelines are appended to the
// description, and guidance on choosing a target and on particular runtimes
// goes with the `target` parameter.
// Tool results are pi-repl's text content; its `details` feed Pi's UI and are
// not shown to the model in Pi either. pi-repl labels recorded submissions with
// PI_REPL_AGENT_LABEL, which the server sets from the connecting client's name
// unless it is already set.
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type Implementation, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { Compile } from "typebox/compile";
import { Value } from "typebox/value";
import { hostContext, loadPiRepl, type Level } from "./host.js";
import type { ToolDefinition } from "./pi-compat/index.js";
import { forAgentRepl } from "./text.js";

export const INSTRUCTIONS = `agent-repl provides long-lived REPL sessions (Python/IPython, Julia, R, GHCi, Clojure, Ruby, Java, Octave, MATLAB, gnuplot and C++) running in tmux. The user can watch and type into the same session from a terminal, so treat it as shared state: inspect before changing it, and do not assume variables exist.

Start or reuse a session with repl_start, choosing the runtime explicitly, then run code with repl_send. Use repl_status to check which sessions are running. Stopping or restarting a session is the user's decision; they can run \`agent-repl stop <runtime>\` in a terminal. To show the user the session, suggest \`agent-repl attach <runtime>\`.

These are the same tmux sessions pi-repl uses (pi-repl-python, pi-repl-julia, ...), so other agents and Pi may be using them too. Messages from these tools can mention pi-repl's Pi commands /repl and /lab; outside Pi the same command is \`agent-repl\` in a terminal (\`/repl stop python\` is \`agent-repl stop python\`).`;

const TARGET_GUIDANCE = /^(?:In (?:GHCi|Clojure|Ruby|Java)|For (?:Octave|MATLAB|C\+\+|gnuplot))(?!\w)|\btarget='/;

// Claude Code and Codex send a display title; OpenCode sends only its name.
const CLIENT_NAMES: Record<string, string> = { opencode: "OpenCode" };

/** The name recorded for a client's submissions, e.g. "Claude Code" for claude-code. */
export function agentLabel(client: Implementation | undefined): string | undefined {
	if (!client) return undefined;
	return client.title?.trim() || CLIENT_NAMES[client.name] || client.name?.trim() || undefined;
}

type JsonSchema = { properties?: Record<string, { description?: string }>; [key: string]: unknown };

export function describeTool(tool: ToolDefinition): Tool {
	const guidelines = (tool.promptGuidelines ?? []).map(forAgentRepl);
	// A JSON copy drops TypeBox's symbol-keyed metadata and leaves plain JSON Schema.
	const inputSchema = JSON.parse(JSON.stringify(tool.parameters)) as JsonSchema;
	for (const property of Object.values(inputSchema.properties ?? {})) {
		if (property.description) property.description = forAgentRepl(property.description);
	}
	const target = inputSchema.properties?.target;
	const targetGuidance = target ? guidelines.filter(line => TARGET_GUIDANCE.test(line)) : [];
	if (target && targetGuidance.length) target.description = [target.description, "", ...targetGuidance.map(line => `- ${line}`)].join("\n");
	const general = guidelines.filter(line => !targetGuidance.includes(line));
	const description = [forAgentRepl(tool.description), ...(general.length ? ["", ...general.map(line => `- ${line}`)] : [])].join("\n");
	return {
		name: tool.name,
		title: tool.label,
		description,
		inputSchema: inputSchema as Tool["inputSchema"],
		annotations: { title: tool.label, readOnlyHint: tool.name === "repl_status", destructiveHint: false, openWorldHint: false },
	};
}

// As Pi does before calling a tool: optional nulls dropped, TypeBox conversion
// (e.g. "5000" to 5000), then validation.
function validateArguments(tool: ToolDefinition, input: unknown): unknown {
	const args = structuredClone(input ?? {}) as Record<string, unknown>;
	const required = new Set((tool.parameters as { required?: string[] }).required ?? []);
	for (const key of Object.keys(args)) if (args[key] === null && !required.has(key)) delete args[key];
	Value.Convert(tool.parameters, args);
	const validator = Compile(tool.parameters);
	if (validator.Check(args)) return args;
	const errors = validator.Errors(args).map(error => {
		const path = error.instancePath.replace(/^\//, "").replace(/\//g, ".");
		const missing = error.keyword === "required" ? (error.params as { requiredProperties?: string[] }).requiredProperties?.[0] : undefined;
		return `  - ${missing ?? (path || "root")}: ${error.message}`;
	});
	throw new Error(`Invalid arguments for ${tool.name}:\n${errors.join("\n") || "  - unknown validation error"}`);
}

export interface McpOptions { cwd: string; version: string; log?: (message: string) => void }

export function createMcpServer({ cwd, version, log = message => process.stderr.write(`${message}\n`) }: McpOptions): Server {
	const { tools } = loadPiRepl();
	const described = [...tools.values()].map(describeTool);
	const server = new Server({ name: "agent-repl", title: "agent-repl", version }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });
	const labelSetByUser = Boolean(process.env.PI_REPL_AGENT_LABEL?.trim());
	server.oninitialized = () => {
		const label = agentLabel(server.getClientVersion());
		if (!labelSetByUser && label) process.env.PI_REPL_AGENT_LABEL = label;
	};
	server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: described }));
	server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
		const tool = tools.get(request.params.name);
		if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
		const notify = (message: string, level: Level) => log(`[agent-repl ${level}] ${message}`);
		try {
			const params = validateArguments(tool, request.params.arguments);
			const result = await tool.execute(`mcp-${randomUUID()}`, params, extra.signal, undefined, hostContext(cwd, notify));
			return { content: result.content };
		} catch (error) {
			return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true };
		}
	});
	return server;
}

export async function runMcpServer(options: McpOptions): Promise<void> {
	const server = createMcpServer(options);
	await server.connect(new StdioServerTransport());
	const close = () => { void server.close().finally(() => process.exit(0)); };
	process.stdin.on("end", close);
	process.on("SIGINT", close);
	process.on("SIGTERM", close);
}
