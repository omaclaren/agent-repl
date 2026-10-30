import test from "node:test";
import assert from "node:assert/strict";
import { splitArgs } from "../dist/args.js";

test("--cwd is taken anywhere before the command's arguments end", () => {
	assert.deepEqual(splitArgs(["--cwd", "/tmp/a", "status", "python"], "/x"), { cwd: "/tmp/a", args: ["status", "python"] });
	assert.deepEqual(splitArgs(["status", "--cwd=/tmp/b", "python"], "/x"), { cwd: "/tmp/b", args: ["status", "python"] });
	assert.deepEqual(splitArgs(["--", "status", "--cwd=/tmp/b"], "/x"), { cwd: "/x", args: ["status", "--cwd=/tmp/b"] });
});

test("an input command's answer is passed on as given", () => {
	assert.deepEqual(splitArgs(["input", "--cwd=/tmp"], "/x"), { cwd: "/x", args: ["input", "--cwd=/tmp"] });
	assert.deepEqual(splitArgs(["--cwd", "/tmp/a", "INPUT", "--", "-d", "--cwd", "y"], "/x"), { cwd: "/tmp/a", args: ["INPUT", "--", "-d", "--cwd", "y"] });
});

test("a send's -c and -f values are passed on as given, and --cwd is still taken around them", () => {
	assert.deepEqual(splitArgs(["send", "python", "-c", "--cwd=/tmp"], "/x"), { cwd: "/x", args: ["send", "python", "-c", "--cwd=/tmp"] });
	assert.deepEqual(splitArgs(["send", "-f", "--cwd", "--cwd", "/a"], "/x"), { cwd: "/a", args: ["send", "-f", "--cwd"] });
	assert.deepEqual(splitArgs(["--cwd=/b", "SEND", "-c", "print(1)", "julia"], "/x"), { cwd: "/b", args: ["SEND", "-c", "print(1)", "julia"] });
	assert.deepEqual(splitArgs(["send", "-c"], "/x"), { cwd: "/x", args: ["send", "-c"] });
	// Only send's: elsewhere -c is an ordinary argument.
	assert.deepEqual(splitArgs(["status", "-c", "--cwd=/c"], "/x"), { cwd: "/c", args: ["status", "-c"] });
});
