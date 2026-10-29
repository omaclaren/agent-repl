// End to end: `agent-repl mcp` over stdio and the CLI, against a real Python
// REPL. Everything runs on a separate tmux server (its own TMUX_TMPDIR) with
// a temporary HOME, so the user's tmux sessions are never touched.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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
const lfortran = process.env.PI_REPL_LFORTRAN;
const skipLfortran = skip || (!lfortran && "set PI_REPL_LFORTRAN to an lfortran built from LFortran's main branch");

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

/** `agent-repl send` as a person runs it: code on stdin, stderr watched for the notice. */
function cliSend(args, code) {
	const child = spawn(process.execPath, [cli, "send", ...args], { cwd: project, env, stdio: ["pipe", "pipe", "pipe"] });
	let stdout = "", stderr = "";
	child.stdout.on("data", (data) => { stdout += data; });
	child.stderr.on("data", (data) => { stderr += data; });
	child.stdin.end(code);
	const exited = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal, stdout, stderr })));
	const until = async (pattern) => {
		const deadline = Date.now() + 20000;
		while (!pattern.test(stderr)) {
			if (Date.now() > deadline) throw new Error(`no ${pattern} on stderr: ${stderr}`);
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	};
	return { child, exited, until };
}

test("CLI: send waits past its notice until the code is done, and another send waits its turn", { skip, timeout: 60000 }, async () => {
	const send = cliSend(["python", "--notice", "1"], "import time\ntime.sleep(2.5)\nprint('CLI_LATE')\n");
	await send.until(/^Still running in pi-repl-python\. Waiting so its output is recorded and no other send picks it up\./m);
	// An agent's send meanwhile waits for the lease, and gets only its own output.
	const other = await client.callTool({ name: "repl_send", arguments: { code: "print('MCP_ONLY')" } });
	const result = await send.exited;
	assert.equal(result.code, 0, result.stderr);
	assert.match(result.stdout, /^agent-repl send to pi-repl-python:\n\n```\n[\s\S]*Output:\nCLI_LATE\n```\n?$/);
	assert.match(text(other), /Output:\nMCP_ONLY$/);
	assert.doesNotMatch(text(other).split("Output:")[1], /CLI_LATE/);
});

test("CLI: env runs the Python inspection as a settled send", { skip, timeout: 60000 }, () => {
	const env_ = spawnSync(process.execPath, [cli, "env"], { cwd: project, env, encoding: "utf8", timeout: 30000 });
	assert.equal(env_.status, 0, env_.stderr);
	assert.match(env_.stdout, /^Python\/IPython REPL environment:\nRuntime: python\nSession: pi-repl-python\n\nsys\.executable=/);
});

test("MCP: a server whose client closes waits for a send still running, so its output is recorded", { skip, timeout: 60000 }, async () => {
	const drained = new Client({ name: "agent-repl-e2e-drain", title: "E2E Drain", version: "0" });
	const transport = new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], cwd: project, env, stderr: "pipe" });
	let stderr = "";
	transport.stderr?.on("data", (data) => { stderr += data; });
	await drained.connect(transport);
	let sent;
	let closedAfter;
	try {
		sent = await drained.callTool({ name: "repl_send", arguments: { code: "import time\ntime.sleep(1.5)\nprint('DRAINED')", timeoutMs: 1000 } });
	} finally {
		// Closing stdin: the server waits for the send rather than exit before its output is recorded.
		const started = Date.now();
		await drained.close();
		closedAfter = Date.now() - started;
	}
	assert.equal(sent.isError, true);
	assert.match(text(sent), /The code may still be running in pi-repl-python\. Don't send it again/);
	assert.ok(closedAfter < 2000, "it exited by itself, before the SDK's SIGTERM");
	assert.match(stderr, /^agent-repl: waiting for 1 send\(s\) still running, so that their output is recorded and no other send takes it\.$/m);
	assert.match(run("status", "python").stdout, /^Latest clean entry: pi-repl · E2E Drain · captured$/m);
});

test("MCP: a client that disconnects while its tool call still waits leaves the send recorded", { skip, timeout: 60000 }, async () => {
	const leaving = new Client({ name: "agent-repl-e2e-leave", title: "E2E Leave", version: "0" });
	const transport = new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], cwd: project, env, stderr: "pipe" });
	await leaving.connect(transport);
	// Still inside its 20 s wait when the client goes: the server must hand it to an owner, not exit.
	const call = leaving.callTool({ name: "repl_send", arguments: { code: "import time\ntime.sleep(1.5)\nprint('LEFT_BEHIND')", timeoutMs: 20000 } }).catch((error) => error);
	await new Promise((resolve) => setTimeout(resolve, 500));
	const started = Date.now();
	try {
		await leaving.close();
		await call;
	} finally {
		await transport.close().catch(() => undefined);
	}
	assert.ok(Date.now() - started < 2000, "it exited by itself, before the SDK's SIGTERM");
	assert.match(run("status", "python").stdout, /^Latest clean entry: pi-repl · E2E Leave · captured$/m);
});

test("CLI: the first Ctrl-C keeps waiting; a second stops waiting, and says that's unsafe", { skip, timeout: 60000 }, async () => {
	const kept = cliSend(["python", "--notice", "1"], "import time\ntime.sleep(3)\nprint('AFTER_CTRL_C')\n");
	await kept.until(/^Still running/m);
	kept.child.kill("SIGINT");
	await kept.until(/^The code keeps running and this command is still waiting/m);
	const finished = await kept.exited;
	assert.equal(finished.code, 0, finished.stderr);
	assert.match(finished.stdout, /Output:\nAFTER_CTRL_C/);

	const stopped = cliSend(["python", "--notice", "1"], "import time\ntime.sleep(4)\n");
	await stopped.until(/^Still running/m);
	stopped.child.kill("SIGINT");
	await stopped.until(/^The code keeps running/m);
	stopped.child.kill("SIGINT");
	const exited = await stopped.exited;
	assert.equal(exited.code, 130);
	assert.match(exited.stderr, /^Stopped waiting\. The code may still be running in pi-repl-python, and after 30 seconds another send may record its late output\.$/m);
	// Its sleep ends before the next test stops the session.
	await new Promise((resolve) => setTimeout(resolve, 4000));
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

test("CLI: send refuses empty or invalid code and bad options before anything is sent", { skip }, () => {
	const send = (args, input) => spawnSync(process.execPath, [cli, "send", ...args], { cwd: project, env, timeout: 30000, input, encoding: "utf8" });
	for (const [args, input, message] of [
		[["python"], " \n", /^Nothing was sent: the code is empty\.$/m],
		[["python"], Buffer.from([0xff, 0x0a]), /^Nothing was sent: the code isn't valid UTF-8\.$/m],
		[["python"], "x".repeat(200_001), /^Nothing was sent: the code is longer than 200,000 characters\.$/m],
		[["python", "--notice", "0"], "print(1)\n", /^--notice takes a number of seconds from 1 to 3600\.$/m],
		[["python", "-c", "print(1)"], "print(1)\n", /^Unknown option for agent-repl send: -c$/m],
	]) {
		const result = send(args, input);
		assert.equal(result.status, 1, `${args.join(" ")}: ${result.stdout}${result.stderr}`);
		assert.match(result.stderr, message);
	}
});

test("CLI: unknown runtimes fail with pi-repl's message", { skip }, () => {
	const result = run("cobol");
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Unknown agent-repl subcommand or runtime: cobol/);
	assert.match(result.stderr, /agent-repl python/);
});

test("MCP and CLI: LFortran's shared session, with READs answered by repl_input and by agent-repl input", { skip: skipLfortran, timeout: 120000 }, async () => {
	writeFileSync(join(root, "bin", "lfortran"), `#!/bin/sh\nexec ${quote(lfortran)} "$@"\n`, { mode: 0o700 });
	let stopped;
	try {
		const started = await client.callTool({ name: "repl_start", arguments: { runtime: "lfortran", timeoutMs: 60000 } });
		assert.match(text(started), /Readiness: the helper and kernel are ready/, text(started));

		const sent = await client.callTool({ name: "repl_send", arguments: { code: "integer :: n = 41\nprint *, n + 1", target: "lfortran" } });
		assert.match(text(sent), /^Completed\.[\s\S]*Output:\n\s*42\s*$/, text(sent));

		const reading = await client.callTool({ name: "repl_send", arguments: { code: "integer :: k\nread(*, *) k\nprint *, 'got', k * 2", target: "lfortran" } });
		const token = /repl_input token='([0-9a-f]{32})'/.exec(text(reading))?.[1];
		assert.ok(token, text(reading));
		const answered = await client.callTool({ name: "repl_input", arguments: { token, text: "21" } });
		assert.match(text(answered), /got\s+42/, text(answered));

		// The person answers the next READ from a terminal, and sends their own cell.
		await client.callTool({ name: "repl_send", arguments: { code: "read(*, *) k\nprint *, 'got', k * 2", target: "lfortran" } });
		const input = run("input", "5");
		assert.equal(input.status, 0, input.stderr);
		assert.match(input.stdout, /got\s+10/);
		// An answer that looks like an option, and a cell whose code mentions a Pi command, are passed on and shown as they are.
		await client.callTool({ name: "repl_send", arguments: { code: "character(len=20) :: s\nread(*, '(a)') s\nprint *, trim(s), ' /lab python'", target: "lfortran" } });
		const option = run("input", "--cwd=/tmp");
		assert.equal(option.status, 0, option.stderr);
		assert.match(option.stdout, /--cwd=\/tmp \/lab python/);
		const piped = spawnSync(process.execPath, [cli, "send", "lfortran"], { cwd: project, env, encoding: "utf8", timeout: 30000, input: "print *, n\n" });
		assert.equal(piped.status, 0, piped.stderr);
		assert.match(piped.stdout, /Output:\n\s*41/);
		// A READ in the person's own cell: the hint after the result names agent-repl's command.
		const asks = spawnSync(process.execPath, [cli, "send", "lfortran"], { cwd: project, env, encoding: "utf8", timeout: 30000, input: "read(*, *) k\nprint *, 'got', k * 2\n" });
		assert.match(asks.stdout, /```\n\nTo answer it from here: agent-repl input <text>\n?$/, asks.stdout);
		assert.match(run("input", "3").stdout, /got\s+6/);

		assert.match(run("status", "lfortran").stdout, /The helper and kernel: ready/);
		const attach = run("attach", "lfortran");
		assert.match(attach.stdout, /^tmux attach -t pi-repl-lfortran$/m);
		assert.doesNotMatch(attach.stdout, /Pane text/);
	} finally {
		stopped = run("stop", "lfortran");
	}
	assert.match(stopped.stdout, /Stopped the shared LFortran session/, stopped.stdout + stopped.stderr);
});
