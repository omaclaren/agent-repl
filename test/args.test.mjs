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
