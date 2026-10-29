// Stand-ins for pi-tui's Box and Text, which pi-repl draws its /repl send and
// /repl input messages with. agent-repl's host has no message renderers, so it
// never draws one; these let pi-repl's source compile, and its tests of those
// messages run, without pi-tui, whose Box needs its whole TUI. They lay out
// plain text as pi-tui's do: wrapped at spaces to the width, then padded.
import { stripTerminalSequences } from "./ansi.js";

export interface Component {
	render(width: number): string[];
	invalidate(): void;
}

/** `line` in pieces of at most `width` characters, broken at spaces where it can be. */
function wrap(line: string, width: number): string[] {
	const pieces: string[] = [];
	let rest = line;
	while ([...stripTerminalSequences(rest)].length > width) {
		const head = [...rest].slice(0, width + 1).join("");
		const space = head.lastIndexOf(" ");
		const cut = space > 0 ? space : [...rest].slice(0, width).join("").length;
		pieces.push(rest.slice(0, cut).trimEnd());
		rest = rest.slice(cut).trimStart();
	}
	pieces.push(rest);
	return pieces;
}

function pad(lines: string[], width: number, paddingX: number, paddingY: number, background?: (text: string) => string): string[] {
	const side = " ".repeat(paddingX);
	const blank = Array<string>(paddingY).fill("");
	return [...blank, ...lines.map(line => `${side}${line}`), ...blank]
		.map(line => line + " ".repeat(Math.max(0, width - [...stripTerminalSequences(line)].length)))
		.map(line => background ? background(line) : line);
}

export class Text implements Component {
	constructor(private text = "", private paddingX = 1, private paddingY = 1, private customBgFn?: (text: string) => string) {}

	render(width: number): string[] {
		const inner = Math.max(1, width - 2 * this.paddingX);
		return pad(this.text.split("\n").flatMap(line => wrap(line, inner)), width, this.paddingX, this.paddingY, this.customBgFn);
	}

	invalidate(): void {}
}

export class Box implements Component {
	private children: Component[] = [];

	constructor(private paddingX = 1, private paddingY = 1, private bgFn?: (text: string) => string) {}

	addChild(component: Component): void {
		this.children.push(component);
	}

	render(width: number): string[] {
		const inner = Math.max(1, width - 2 * this.paddingX);
		return pad(this.children.flatMap(child => child.render(inner)), width, this.paddingX, this.paddingY, this.bgFn);
	}

	invalidate(): void {}
}
