import test from "node:test";
import assert from "node:assert/strict";
import { attachArgs } from "../dist/attach.js";

test("attaching forces UTF-8, and inside tmux switches the client instead", () => {
	assert.deepEqual(attachArgs("pi-repl-julia", false), ["-u", "attach", "-t", "pi-repl-julia"]);
	assert.deepEqual(attachArgs("pi-repl-julia", true), ["switch-client", "-t", "pi-repl-julia"]);
});
