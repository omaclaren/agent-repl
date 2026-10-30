import test from "node:test";
import assert from "node:assert/strict";
import { accessSync, constants, readFileSync } from "node:fs";
import { SHORTCUTS, shortcutArgs } from "../dist/shortcuts.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("a shortcut's first argument is the code, unless it starts with -, and with none the code comes from stdin", () => {
	assert.deepEqual(shortcutArgs("julia", ["println(1)"]), ["send", "julia", "-c", "println(1)"]);
	assert.deepEqual(shortcutArgs("julia", ["println(1)", "--notice", "60"]), ["send", "julia", "-c", "println(1)", "--notice", "60"]);
	assert.deepEqual(shortcutArgs("python", ["-f", "script.py"]), ["send", "python", "-f", "script.py"]);
	assert.deepEqual(shortcutArgs("python", ["-c", "-1 + 2"]), ["send", "python", "-c", "-1 + 2"]);
	assert.deepEqual(shortcutArgs("python", ["--cwd", "/tmp", "-c", "x"]), ["send", "python", "--cwd", "/tmp", "-c", "x"]);
	assert.deepEqual(shortcutArgs("r", []), ["send", "r"]);
	// Code that only looks like an option after the first argument is still send's to judge.
	assert.deepEqual(shortcutArgs("r", ["\nprint(1)\n"]), ["send", "r", "-c", "\nprint(1)\n"]);
});

test("every shortcut is in package.json's bin, and its built script runs agent-repl send for its runtime", () => {
	const bins = Object.entries(pkg.bin).filter(([name]) => name !== "agent-repl");
	assert.deepEqual(Object.fromEntries(bins), Object.fromEntries(Object.keys(SHORTCUTS).map((name) => [name, `dist/bin/${name}.js`])));
	assert.equal(new Set(Object.values(SHORTCUTS)).size, Object.keys(SHORTCUTS).length, "one shortcut per runtime");
	for (const [name, runtime] of Object.entries(SHORTCUTS)) {
		const path = new URL(`../dist/bin/${name}.js`, import.meta.url);
		accessSync(path, constants.X_OK);
		const script = readFileSync(path, "utf8");
		assert.match(script, /^#!\/usr\/bin\/env node\n/);
		assert.ok(script.includes(`shortcutArgs(${JSON.stringify(runtime)}, process.argv.slice(2))`), name);
	}
});
