// Compiles src/ to dist/ with tsc, then copies the JavaScript that is used
// as-is (pi-repl's shared/ and the Pi helpers in pi-compat/, with their
// licence) verbatim, and writes a bin script for each shortcut.
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", join(root, "tsconfig.json")], { stdio: "inherit" });
cpSync(join(root, "src", "shared"), join(dist, "shared"), { recursive: true });
for (const name of readdirSync(join(root, "src", "pi-compat"))) {
	if (name.endsWith(".js") || name === "LICENSE") cpSync(join(root, "src", "pi-compat", name), join(dist, "pi-compat", name));
}
chmodSync(join(dist, "cli.js"), 0o755);
// Each shortcut puts its arguments in agent-repl's form, then runs the CLI as agent-repl itself would.
const { SHORTCUTS } = await import(pathToFileURL(join(dist, "shortcuts.js")).href);
mkdirSync(join(dist, "bin"));
for (const [name, runtime] of Object.entries(SHORTCUTS)) {
	const script = join(dist, "bin", `${name}.js`);
	writeFileSync(script, `#!/usr/bin/env node
// ${name}: agent-repl send ${runtime}. Written by scripts/build.mjs.
import { shortcutArgs } from "../shortcuts.js";
process.argv.splice(2, Infinity, ...shortcutArgs(${JSON.stringify(runtime)}, process.argv.slice(2)));
await import("../cli.js");
`);
	chmodSync(script, 0o755);
}
