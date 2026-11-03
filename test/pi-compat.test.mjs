import test from "node:test";
import assert from "node:assert/strict";
import { stripTerminalSequences } from "../dist/pi-compat/ansi.js";

// pi-tui's copy is assembled from its utils.js; a helper it calls and the sync missed would throw here.
test("the copy of pi-tui's stripTerminalSequences strips CSI, OSC and APC sequences", () => {
	assert.equal(stripTerminalSequences("plain"), "plain");
	assert.equal(stripTerminalSequences("a\x1b[31mred\x1b[0m b"), "ared b");
	assert.equal(stripTerminalSequences("\x1b]8;;https://example.com\x07link\x1b]8;;\x1b\\ \x1b_marker\x07end"), "link end");
});
