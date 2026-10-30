// Short commands for `agent-repl send <runtime>`, one per runtime, named by the
// runtime's usual file extension, or its name where that's ambiguous (Octave and
// MATLAB share .m) or little known (gnuplot). scripts/build.mjs writes a bin
// script for each into dist/bin/, and package.json's "bin" lists them.

export const SHORTCUTS: Readonly<Record<string, string>> = {
	"agent-repl-py": "python",
	"agent-repl-jl": "julia",
	"agent-repl-r": "r",
	"agent-repl-hs": "ghci",
	"agent-repl-clj": "clojure",
	"agent-repl-rb": "ruby",
	"agent-repl-java": "java",
	"agent-repl-cpp": "cpp",
	"agent-repl-f90": "lfortran",
	"agent-repl-octave": "octave",
	"agent-repl-matlab": "matlab",
	"agent-repl-gnuplot": "gnuplot",
};

/**
 * agent-repl's arguments for a shortcut: the first argument is the code, with
 * anything after it passed on as send's options. A first argument that starts
 * with `-` means they are all send's, as in `agent-repl-py -f script.py`, and
 * with none, the code comes from stdin.
 */
export function shortcutArgs(runtime: string, args: string[]): string[] {
	if (args.length === 0 || args[0].startsWith("-")) return ["send", runtime, ...args];
	return ["send", runtime, "-c", args[0], ...args.slice(1)];
}
