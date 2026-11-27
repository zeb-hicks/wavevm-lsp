import * as fs from 'fs';
import * as path from 'path';

export type AssemblerDiagnostic = {
	message: string;
	/** UTF-16 offsets into the assembled text */
	start: number;
	end: number;
}

interface AssemblerExports {
	memory: WebAssembly.Memory;
	alloc(len: number): number;
	dealloc(ptr: number, len: number): void;
	assemble(ptr: number, len: number): number;
}

const wasmPath = path.join(__dirname, 'waveasm.wasm');
let wasmModule: WebAssembly.Module | undefined;
let instance: AssemblerExports | undefined;

function getInstance(): AssemblerExports {
	if (!instance) {
		wasmModule ??= new WebAssembly.Module(fs.readFileSync(wasmPath));
		instance = new WebAssembly.Instance(wasmModule).exports as unknown as AssemblerExports;
	}
	return instance;
}

function run(source: Buffer): { diagnostics: { message: string, start: number, end: number }[] } {
	const wasm = getInstance();
	const inPtr = wasm.alloc(source.length);
	// Memory may grow on any call into wasm, so views are created after each call.
	new Uint8Array(wasm.memory.buffer, inPtr, source.length).set(source);
	const outPtr = wasm.assemble(inPtr, source.length);
	wasm.dealloc(inPtr, source.length);

	const outLen = new DataView(wasm.memory.buffer).getUint32(outPtr, true);
	const json = Buffer.from(wasm.memory.buffer, outPtr + 4, outLen).toString('utf8');
	wasm.dealloc(outPtr, outLen + 4);
	return JSON.parse(json);
}

/**
 * Assembles the given source with the real Wave2 assembler (compiled to WASM)
 * and returns the errors it reports.
 */
export function assemble(text: string): AssemblerDiagnostic[] {
	const source = Buffer.from(text, 'utf8');
	let result;
	try {
		result = run(source);
	} catch (e) {
		// A trap (e.g. an assembler panic) leaves the instance in an undefined state.
		instance = undefined;
		const message = e instanceof Error ? e.message : String(e);
		return [{ message: `The Wave2 assembler failed unexpectedly: ${message}`, start: 0, end: 0 }];
	}

	const ascii = source.length === text.length;
	const toOffset = (byteOffset: number) => ascii
		? Math.min(byteOffset, text.length)
		: source.subarray(0, Math.min(byteOffset, source.length)).toString('utf8').length;

	return result.diagnostics.map(d => ({
		message: d.message,
		start: toOffset(d.start),
		end: toOffset(d.end),
	}));
}
