import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadPiRepl } from "../dist/host.js";
import { createMcpServer } from "../dist/mcp.js";
import { forAgentRepl } from "../dist/text.js";

async function connect() {
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const server = createMcpServer({ cwd: process.cwd(), version: "0.0.0-test", log: () => {} });
	const client = new Client({ name: "test", version: "0" });
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
	return { client, close: () => Promise.all([client.close(), server.close()]) };
}

test("lists pi-repl's three tools with its descriptions and guidelines", async (t) => {
	const { client, close } = await connect();
	t.after(close);
	const { tools } = await client.listTools();
	assert.deepEqual(tools.map(tool => tool.name).sort(), ["repl_send", "repl_start", "repl_status"]);
	const instructions = client.getInstructions();
	// Claude Code caps tool descriptions and server instructions at 2,048 characters.
	assert.ok(instructions.length <= 2048);
	for (const tool of tools) {
		const source = loadPiRepl().tools.get(tool.name);
		assert.ok(tool.description.length <= 2048, `${tool.name} description is ${tool.description.length} characters`);
		assert.ok(tool.description.startsWith(forAgentRepl(source.description)));
		assert.deepEqual(tool.inputSchema.required, source.parameters.required);
		assert.deepEqual(Object.keys(tool.inputSchema.properties), Object.keys(source.parameters.properties));
		// Every guideline appears once, in the description or with the target parameter.
		const where = [tool.description, tool.inputSchema.properties.target?.description ?? ""].join("\n");
		for (const guideline of source.promptGuidelines) {
			assert.equal(where.split(`- ${forAgentRepl(guideline)}`).length - 1, 1, guideline.slice(0, 60));
		}
		assert.doesNotMatch(JSON.stringify(tool), /(^|[\s"'`(])\/(repl|lab)\b/, `${tool.name} still mentions a Pi command`);
	}
	const send = tools.find(tool => tool.name === "repl_send");
	assert.match(send.inputSchema.properties.target.description, /target='julia'/);
	assert.match(send.inputSchema.properties.target.description, /For C\+\+ use target='cpp'/);
	assert.deepEqual(send.inputSchema.properties.echoMode.enum, ["off", "summary", "full"]);
	assert.equal(tools.find(tool => tool.name === "repl_status").annotations.readOnlyHint, true);
});

test("invalid arguments are reported as tool errors without running anything", async (t) => {
	const { client, close } = await connect();
	t.after(close);
	const missing = await client.callTool({ name: "repl_send", arguments: {} });
	assert.equal(missing.isError, true);
	assert.match(missing.content[0].text, /Invalid arguments for repl_send:\n {2}- code:/);
	const runtime = await client.callTool({ name: "repl_start", arguments: { runtime: "cobol" } });
	assert.equal(runtime.isError, true);
	assert.match(runtime.content[0].text, /runtime/);
	const unknown = await client.callTool({ name: "repl_reset", arguments: {} });
	assert.equal(unknown.isError, true);
});
