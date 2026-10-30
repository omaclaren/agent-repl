import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { MAX_CODE_CHARS, codeFor, parseSendArgs, readCode } from "../dist/send.js";

const read = (...chunks) => readCode(Readable.from(chunks.map((chunk) => Buffer.from(chunk))));

test("code from stdin keeps its trailing newline, with line endings as the record keeps them", async () => {
	assert.equal(await read("print(1)\r\n", "print(2)\n"), "print(1)\nprint(2)\n");
	assert.equal(await read("x = 'λ'\r"), "x = 'λ'\n");
	assert.equal((await read("x".repeat(MAX_CODE_CHARS))).length, MAX_CODE_CHARS);
});

test("empty, invalid or too long code is refused, never truncated", async () => {
	await assert.rejects(read(" \n\t\n"), /^Error: Nothing was sent: the code is empty\.$/);
	await assert.rejects(readCode(Readable.from([Buffer.from([0x70, 0xff, 0x0a])])), /^Error: Nothing was sent: the code isn't valid UTF-8\.$/);
	await assert.rejects(read("x".repeat(MAX_CODE_CHARS + 1)), /^Error: Nothing was sent: the code is longer than 200,000 characters\.$/);
	// The read stops just past the limit rather than reading everything first.
	let pulled = 0;
	const endless = new Readable({ read() { pulled += 1; this.push(Buffer.alloc(64 * 1024, 0x78)); } });
	await assert.rejects(readCode(endless), /longer than 200,000 characters/);
	assert.ok(pulled < 20, `read ${pulled} chunks`);
});

test("send takes one runtime, --notice and --lease-wait", () => {
	assert.deepEqual(parseSendArgs([]), {});
	assert.deepEqual(parseSendArgs(["julia", "--notice", "5", "--lease-wait=0"]), { runtime: "julia", noticeSeconds: 5, leaseWaitSeconds: 0 });
	assert.throws(() => parseSendArgs(["--notice", "0"]), /--notice takes a number of seconds from 1 to 3600/);
	assert.throws(() => parseSendArgs(["--lease-wait=3601"]), /--lease-wait takes a number of seconds from 0 to 3600/);
	assert.throws(() => parseSendArgs(["--notice"]), /--notice takes/);
	assert.throws(() => parseSendArgs(["-x"]), /Unknown option for agent-repl send: -x/);
	assert.throws(() => parseSendArgs(["python", "julia"]), /takes one runtime; got python and julia/);
});

test("send takes its code from -c or -f, whole, and from only one place", () => {
	assert.deepEqual(parseSendArgs(["julia", "-c", "println(1)"]), { runtime: "julia", code: "println(1)" });
	// A value that looks like an option is the code, or the file, all the same.
	assert.deepEqual(parseSendArgs(["-c", "-x", "python"]), { code: "-x", runtime: "python" });
	assert.deepEqual(parseSendArgs(["-c", "--notice", "--notice", "5"]), { code: "--notice", noticeSeconds: 5 });
	assert.deepEqual(parseSendArgs(["-f", "-"]), { file: "-" });
	assert.deepEqual(parseSendArgs(["-f", "--cwd=x.py"]), { file: "--cwd=x.py" });
	assert.throws(() => parseSendArgs(["-c"]), /^Error: -c takes the code to send, as one argument\.$/);
	assert.throws(() => parseSendArgs(["-f"]), /^Error: -f takes a file to send, or - for stdin\.$/);
	for (const args of [["-c", "1", "-f", "x.py"], ["-c", "1", "-c", "2"], ["-f", "a", "-f", "b"]]) {
		assert.throws(() => parseSendArgs(args), /^Error: Nothing was sent: give the code once, with -c, -f or stdin\.$/, args.join(" "));
	}
});

test("-c's code and -f's file are checked as stdin's code is, and stdin isn't read with either", async (t) => {
	const dir = mkdtempSync(join(tmpdir(), "agent-repl-send-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	writeFileSync(join(dir, "script.jl"), "x = 1\r\ny = 2\n");
	writeFileSync(join(dir, "big.py"), "x".repeat(MAX_CODE_CHARS + 1));
	const untouched = { [Symbol.asyncIterator]() { throw new Error("stdin was read"); } };
	assert.equal(await codeFor({ code: "a\r\nb" }, dir, untouched), "a\nb");
	// Code that starts on the line after -c's opening quote loses the blank lines before it, and nothing else.
	assert.equal(await codeFor({ code: "\n \t\r\n\nfor i in x:\n    print(i)\n" }, dir, untouched), "for i in x:\n    print(i)\n");
	assert.equal(await codeFor({ code: "\n    x = 1\n\ny = 2" }, dir, untouched), "    x = 1\n\ny = 2");
	assert.equal(await codeFor({ file: "-" }, dir, Readable.from([Buffer.from("\nprint(3)\n")])), "\nprint(3)\n");
	assert.equal(await codeFor({ file: "script.jl" }, dir, untouched), "x = 1\ny = 2\n");
	assert.equal(await codeFor({ file: join(dir, "script.jl") }, "/", untouched), "x = 1\ny = 2\n");
	assert.equal(await codeFor({ file: "-" }, dir, Readable.from([Buffer.from("print(1)\n")])), "print(1)\n");
	assert.equal(await codeFor({}, dir, Readable.from([Buffer.from("print(2)\n")])), "print(2)\n");
	await assert.rejects(codeFor({ code: " \n" }, dir, untouched), /^Error: Nothing was sent: the code is empty\.$/);
	await assert.rejects(codeFor({ code: "\n\n  " }, dir, untouched), /^Error: Nothing was sent: the code is empty\.$/);
	await assert.rejects(codeFor({ code: "x".repeat(MAX_CODE_CHARS + 1) }, dir, untouched), /longer than 200,000 characters/);
	await assert.rejects(codeFor({ file: "big.py" }, dir, untouched), /longer than 200,000 characters/);
	await assert.rejects(codeFor({ file: "missing.py" }, dir, untouched), /^Error: Nothing was sent: missing\.py can't be read \(ENOENT: no such file or directory/);
	await assert.rejects(codeFor({ file: "." }, dir, untouched), /^Error: Nothing was sent: \. can't be read \(EISDIR/);
});
