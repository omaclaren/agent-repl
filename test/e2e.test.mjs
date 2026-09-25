// End to end: `agent-repl mcp` over stdio and the CLI, against a real Python
// REPL. Everything runs on a separate tmux server (its own TMUX_TMPDIR) with
// a temporary HOME, so the user's tmux sessions are never touched.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const which = command => spawnSync("/bin/sh", ["-c", 'command -v "$1"', "sh", command], { encoding: "utf8" }).stdout.trim();
const python = which("python3");
const skip = process.platform === "win32" || spawnSync("tmux", ["-V"]).status !== 0 ? "tmux is required"
	: !python ? "python3 is required" : false;
const quote = text => `'${text.replace(/'/g, `'"'"'`)}'`;

let root, socketRoot, project, env, client;

before(async () => {
	if (skip) return;
	root = mkdtempSync(join(tmpdir(), "agent-repl-e2e-"));
	project = join(root, "project");
	const home = join(root, "home"), bin = join(root, "bin");
	for (const dir of [project, home, bin]) mkdirSync(dir);
	// pi-repl starts `python` through a login shell; macOS's /etc/profile resets
	// PATH, so the isolated profile puts this launcher first again.
	writeFileSync(join(bin, "python"), `#!/bin/sh\nexec ${quote(python)} -I -q -i "$@"\n`, { mode: 0o700 });
	writeFileSync(join(home, ".profile"), `export PATH=${quote(`${bin}:${process.env.PATH}`)}\n`);
	// Socket paths are limited to about 100 bytes, too few under macOS's temporary directory.
	socketRoot = mkdtempSync("/tmp/ar-");
	env = { ...process.env, HOME: home, SHELL: "/bin/sh", PATH: `${bin}:${process.env.PATH}`, TMPDIR: root,
		TMUX_TMPDIR: socketRoot, PI_REPL_CONTROL_ROOT: join(root, "controls") };
	for (const key of ["TMUX", "TMUX_PANE", "PI_REPL_ECHO_MODE", "PYTHONSTARTUP"]) delete env[key];
	client = new Client({ name: "agent-repl-e2e", title: "E2E Agent", version: "0" });
	await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], cwd: project, env, stderr: "pipe" }));
});

after(async () => {
	if (skip) return;
	await client?.close();
	spawnSync("tmux", ["kill-server"], { env, stdio: "ignore" });
	rmSync(root, { recursive: true, force: true });
	rmSync(socketRoot, { recursive: true, force: true });
});

const text = result => result.content.map(part => part.text).join("\n");
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: project, env, encoding: "utf8", timeout: 30000 });

test("MCP: start a Python REPL, run code in it and report its status", { skip }, async () => {
	const started = await client.callTool({ name: "repl_start", arguments: { runtime: "python" } });
	assert.notEqual(started.isError, true, text(started));
	assert.match(text(started), /pi-repl-python/);
	assert.doesNotMatch(text(started), /ready: false|ready=false/i);

	const sent = await client.callTool({ name: "repl_send", arguments: { code: "x = 6 * 7\nprint(x)" } });
	assert.notEqual(sent.isError, true, text(sent));
	assert.match(text(sent), /^42$/m);

	// State persists between calls; timeoutMs arrives as a string and is converted.
	const again = await client.callTool({ name: "repl_send", arguments: { code: "print(x + 1)", target: "python", timeoutMs: "10000" } });
	assert.match(text(again), /^43$/m);

	const status = await client.callTool({ name: "repl_status", arguments: { target: "python" } });
	assert.match(text(status), /REPL session is running/);
	assert.match(text(status), /Session: pi-repl-python/);
	// pi-repl records the submissions under the client's name.
	assert.match(text(status), /Latest clean entry: pi-repl · E2E Agent · /);
});

test("CLI: status, attach instructions and stop use the same session", { skip }, async () => {
	const status = run("status", "python");
	assert.equal(status.status, 0, status.stderr);
	assert.match(status.stdout, /Session: pi-repl-python/);

	// Without a terminal, attach prints the command instead of attaching.
	const attach = run("attach", "python");
	assert.equal(attach.status, 0, attach.stderr);
	assert.match(attach.stdout, /^tmux attach -t pi-repl-python$/m);

	const exported = run("export", "python");
	assert.equal(exported.status, 0, exported.stderr);
	const markdown = readdirSync(project).filter(name => name.endsWith(".md")).map(name => readFileSync(join(project, name), "utf8")).join("\n");
	assert.match(markdown, /^## 1\. E2E Agent$/m);
	assert.match(markdown, /^42$/m);

	const stop = run("stop", "python");
	assert.equal(stop.status, 0, stop.stderr);
	const stopped = run("status", "python");
	assert.match(stopped.stdout, /agent-repl python, agent-repl ipython\./);
	assert.doesNotMatch(stopped.stdout + stopped.stderr, /\/repl|\/lab/);

	const sent = await client.callTool({ name: "repl_send", arguments: { code: "print(1)" } });
	assert.equal(sent.isError, true, "repl_send must not start a stopped session");
});

test("CLI: unknown runtimes fail with pi-repl's message", { skip }, () => {
	const result = run("cobol");
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Unknown agent-repl subcommand or runtime: cobol/);
	assert.match(result.stderr, /agent-repl python/);
});
