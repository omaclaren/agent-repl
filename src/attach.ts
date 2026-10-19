/** The tmux arguments that show a session in this terminal. */
export function attachArgs(sessionName: string, insideTmux: boolean): string[] {
	// Inside tmux, switch this client to the session instead of nesting tmux.
	// Otherwise -u: without a UTF-8 locale (LANG is unset in some terminals),
	// a new client draws non-ASCII output such as λ or é as underscores.
	return insideTmux ? ["switch-client", "-t", sessionName] : ["-u", "attach", "-t", sessionName];
}
