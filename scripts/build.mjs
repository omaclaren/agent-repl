// Compiles src/ to dist/ with tsc, then copies the JavaScript that is used
// as-is (pi-repl's shared/ and the Pi helpers in pi-compat/) verbatim.
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", join(root, "tsconfig.json")], { stdio: "inherit" });
cpSync(join(root, "src", "shared"), join(dist, "shared"), { recursive: true });
for (const name of readdirSync(join(root, "src", "pi-compat"))) {
	if (name.endsWith(".js")) cpSync(join(root, "src", "pi-compat", name), join(dist, "pi-compat", name));
}
chmodSync(join(dist, "cli.js"), 0o755);
