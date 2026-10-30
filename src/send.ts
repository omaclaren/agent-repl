// agent-repl send and env for the pane runtimes: a person's send that waits
// until its code is done (pi-repl's sendAndSettle), however long it runs, so no
// other send can take its late output as its own. Input and Ctrl-C follow the
// design for people's sends: refuse rather than truncate, and keep waiting at
// the first Ctrl-C.
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { hostContext, loadPiRepl, type Level } from "./host.js";
import { buildReplEnvInspectionCode, formatReplCommandContent, formatReplEnvResult, formatReplSendResult, personRequestId, resolvePersonName, sendAndSettle, sendLfortranForHost } from "./pi-repl.js";

/** The longest code pi-repl's record keeps whole, after newline normalisation. */
export const MAX_CODE_CHARS = 200_000;
// At most three bytes of UTF-8 per UTF-16 unit, so longer input is too long whatever it holds.
const MAX_CODE_BYTES = MAX_CODE_CHARS * 3 + 3;

export class SendRefused extends Error {}
export class CancelledSend extends Error {}

/**
 * Code from a stream, read with a bound: it stops just past the limit and
 * refuses, never sends truncated code. Invalid UTF-8 and empty code are
 * refused too. Line endings are normalised as the record normalises them; a
 * trailing newline is kept.
 */
export async function readCode(stream: AsyncIterable<Buffer | string> & { destroy?: () => void }): Promise<string> {
	const chunks: Buffer[] = [];
	let bytes = 0;
	for await (const chunk of stream) {
		const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
		chunks.push(buffer);
		bytes += buffer.length;
		if (bytes > MAX_CODE_BYTES) {
			stream.destroy?.();
			throw new SendRefused(`Nothing was sent: the code is longer than ${MAX_CODE_CHARS.toLocaleString("en")} characters.`);
		}
	}
	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
	} catch {
		throw new SendRefused("Nothing was sent: the code isn't valid UTF-8.");
	}
	return checkCode(text);
}

/** Code as the record keeps it, or refused: newlines normalised, not empty, and within the limit. */
function checkCode(text: string): string {
	const code = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	if (code.length > MAX_CODE_CHARS) throw new SendRefused(`Nothing was sent: the code is longer than ${MAX_CODE_CHARS.toLocaleString("en")} characters.`);
	if (!code.trim()) throw new SendRefused("Nothing was sent: the code is empty.");
	return code;
}

/**
 * The code `send` was given: `-c`'s argument, the text of `-f`'s file (relative
 * to `cwd`; `-` is stdin), or else stdin. With `-c` or a file, stdin isn't read:
 * an agent's shell gives commands a stdin that isn't a terminal even when
 * nothing is piped in.
 */
export async function codeFor(args: SendArgs, cwd: string, stdin: AsyncIterable<Buffer | string> & { destroy?: () => void }): Promise<string> {
	if (args.code !== undefined) return checkCode(args.code);
	if (args.file === undefined || args.file === "-") return readCode(stdin);
	try {
		return await readCode(createReadStream(resolve(cwd, args.file)));
	} catch (error) {
		if (error instanceof SendRefused) throw error;
		throw new SendRefused(`Nothing was sent: ${args.file} can't be read (${error instanceof Error ? error.message : String(error)}).`);
	}
}

export interface SendArgs { runtime?: string; noticeSeconds?: number; leaseWaitSeconds?: number; code?: string; file?: string }

/**
 * `send`'s arguments after the command: a runtime, `--notice <seconds>` (1–3600), `--lease-wait <seconds>`
 * (0–3600), and the code as `-c <code>` or `-f <file>`, whose values are taken whole, even when they start with `-`.
 */
export function parseSendArgs(args: string[]): SendArgs {
	const parsed: SendArgs = {};
	const seconds = (flag: string, value: string | undefined, min: number) => {
		const number = Number(value);
		if (value === undefined || value === "" || !Number.isFinite(number) || number < min || number > 3600) {
			throw new SendRefused(`${flag} takes a number of seconds from ${min} to 3600.`);
		}
		return number;
	};
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
		if (flag === "--notice") parsed.noticeSeconds = seconds(flag, inline ?? args[++index], 1);
		else if (flag === "--lease-wait") parsed.leaseWaitSeconds = seconds(flag, inline ?? args[++index], 0);
		else if (arg === "-c" || arg === "-f") {
			if (parsed.code !== undefined || parsed.file !== undefined) throw new SendRefused("Nothing was sent: give the code once, with -c, -f or stdin.");
			const value = args[++index];
			if (value === undefined) throw new SendRefused(arg === "-c" ? "-c takes the code to send, as one argument." : "-f takes a file to send, or - for stdin.");
			if (arg === "-c") parsed.code = value;
			else parsed.file = value;
		}
		else if (arg.startsWith("-")) throw new SendRefused(`Unknown option for agent-repl send: ${arg}`);
		else if (parsed.runtime === undefined) parsed.runtime = arg;
		else throw new SendRefused(`agent-repl send takes one runtime; got ${parsed.runtime} and ${arg}.`);
	}
	return parsed;
}

const noticeText = (sessionName: string) => `Still running in ${sessionName}. Waiting so its output is recorded and no other send picks it up. Ctrl-C keeps the code running; pressing it twice stops waiting, which is unsafe.`;
const FIRST_CTRL_C = "The code keeps running and this command is still waiting, so its output is recorded and no other send picks it up. Press Ctrl-C again to stop waiting anyway: after 30 seconds another send may record this code's late output.";
const secondCtrlC = (sessionName: string) => `Stopped waiting. The code may still be running in ${sessionName}, and after 30 seconds another send may record its late output.`;

export interface SettledResult { text: string; exitCode: number }

/**
 * Sends `code` and waits until it settles, with the Ctrl-C handling above.
 * Before the code is sent, Ctrl-C cancels; afterwards the first press keeps
 * waiting and the second exits (130) without releasing the session's lease.
 */
async function settle(cwd: string, options: { runtime?: string; code: string; requestId: string; label: string; noticeSeconds?: number; leaseWaitSeconds?: number }, notify: (message: string, level: Level) => void) {
	const { api } = loadPiRepl();
	const controller = new AbortController();
	let dispatched = false;
	let presses = 0;
	let sessionName = `pi-repl-${options.runtime ?? "python"}`;
	const onSigint = () => {
		if (!dispatched) { controller.abort(); return; }
		if (++presses === 1) { console.error(FIRST_CTRL_C); return; }
		console.error(secondCtrlC(sessionName));
		process.exit(130);
	};
	process.on("SIGINT", onSigint);
	try {
		return await sendAndSettle(api, hostContext(cwd, notify), {
			target: options.runtime, code: options.code, requestId: options.requestId, label: options.label,
			noticeMs: options.noticeSeconds === undefined ? undefined : options.noticeSeconds * 1000,
			leaseWaitMs: options.leaseWaitSeconds === undefined ? undefined : options.leaseWaitSeconds * 1000,
			signal: controller.signal,
			onDispatched: () => { dispatched = true; },
			onNotice: (name) => { sessionName = name; console.error(noticeText(name)); },
		});
	} catch (error) {
		if (controller.signal.aborted && !dispatched) throw new CancelledSend("Cancelled: nothing was sent.");
		throw error;
	} finally {
		process.off("SIGINT", onSigint);
	}
}

/** The person's name for a send's record entry; a problem with the setting is said, and the send goes on. */
function personSending(): string {
	const person = resolvePersonName();
	if (person.warning) console.error(`${person.warning} This send is recorded as ${JSON.stringify(person.name)}.`);
	return person.name;
}

/** `agent-repl send [runtime]` for the pane runtimes: the result as /repl send gives it, its code and output in a fence. */
export async function sendFromStdin(cwd: string, args: SendArgs, code: string, notify: (message: string, level: Level) => void): Promise<SettledResult> {
	const execution = await settle(cwd, { ...args, code, requestId: personRequestId("cli", "send"), label: personSending() }, notify);
	return {
		text: formatReplCommandContent(`/repl send to ${execution.details.sessionName}`, formatReplSendResult(execution.output, execution.details).text),
		// It ran, but the record couldn't be updated: a status of its own.
		exitCode: execution.details.recordWarning ? 2 : 0,
	};
}

/**
 * `agent-repl send lfortran`: LFortran's helper matches output to cells and goes on recording a cell after its
 * sender stops waiting, so there's no lease to wait for and Ctrl-C needs no care. The result is /repl send's.
 */
export async function sendLfortranFromStdin(cwd: string, args: SendArgs, code: string, notify: (message: string, level: Level) => void): Promise<SettledResult> {
	if (args.noticeSeconds !== undefined || args.leaseWaitSeconds !== undefined) throw new SendRefused("Nothing was sent: --notice and --lease-wait are for the pane runtimes, not LFortran.");
	const { api } = loadPiRepl();
	const result = await sendLfortranForHost(api, hostContext(cwd, notify), { code, requestId: personRequestId("cli", "send"), label: personSending() });
	return { text: result.text, exitCode: 0 };
}

/** `agent-repl env`: /repl env's inspection, settled as a send is. */
export async function envSettled(cwd: string, notify: (message: string, level: Level) => void): Promise<SettledResult> {
	const execution = await settle(cwd, { code: buildReplEnvInspectionCode(), requestId: personRequestId("cli", "env"), label: personSending() }, notify);
	const warning = execution.details.recordWarning ? `\n\nShared record warning: ${execution.details.recordWarning}` : "";
	return { text: `${formatReplEnvResult(execution)}${warning}`, exitCode: execution.details.recordWarning ? 2 : 0 };
}
