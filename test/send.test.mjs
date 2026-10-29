import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { MAX_CODE_CHARS, parseSendArgs, readCode } from "../dist/send.js";

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
	assert.throws(() => parseSendArgs(["-c", "print(1)"]), /Unknown option for agent-repl send: -c/);
	assert.throws(() => parseSendArgs(["python", "julia"]), /takes one runtime; got python and julia/);
});
