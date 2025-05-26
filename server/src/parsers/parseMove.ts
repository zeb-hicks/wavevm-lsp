import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { operandTypeFromString, InstructionPart, operandTypeString } from '../parsing';
import { chop, diag } from '../validation';

export function parseMove(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	if (!instruction) return null;

	if (size !== undefined) {
		return diag(`Move instruction does not take a size modifier: ${size}`, DiagnosticSeverity.Error);
	}

	if (operands?.length !== 2) {
		return diag(`Move instructions require 2 operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}

	let dstType = operandTypeFromString(operands[0].text);
	let srcType = operandTypeFromString(operands[1].text);

	if (dstType === null) return diag(`Invalid destination operand for move instruction: ${operands[0].text}`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	if (srcType === null) return diag(`Invalid source operand for move instruction: ${operands[1].text}`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);

	if (dstType === InstructionPart.Immediate) return diag(`Move instruction does not take an immediate value as a destination operand, found ${operands[0].text}`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	if (srcType === InstructionPart.Immediate) return diag(`Move instruction does not take an immediate value as a source operand, found ${operands[1].text}`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);

	let dPtr = dstType === InstructionPart.Pointer || dstType === InstructionPart.PointerIncrement;
	let sPtr = srcType === InstructionPart.Pointer || srcType === InstructionPart.PointerIncrement;

	if (dPtr && sPtr) return diag(`Move instruction can not take two pointer operands.`, DiagnosticSeverity.Error, operands[0].start, operands[1].end);

	let { sOp, sSwi } = /\b(?<sOp>\w+)(?:\.(?<sSwi>\w+))?\b/.exec(operands[1].text)?.groups ?? {};
	let { dOp, dSwi } = /\b(?<dOp>\w+)(?:\.(?<dSwi>\w+))?\b/.exec(operands[0].text)?.groups ?? {};

	let swiMatch = sSwi == dSwi;

	// Valid move instructions:
	// All pointers can be increments
	// Move
	// mov   reg,        reg
	// mov   reg.n,      reg.n
	// Store
	// mov  [reg],       reg
	// mov  [reg],       reg.n
	// mov  [reg.1],     reg.n
	// mov  [reg.xyzw],  reg.n
	// Load
	// mov   reg,       [reg]
	// mov   reg.n,     [reg]
	// mov   reg.n,     [reg.1]
	// mov   reg.n,     [reg.xyzw]

	if (dPtr && sPtr) {
		return diag(`Move instruction can not take two pointer operands.`, DiagnosticSeverity.Error, operands[0].start, operands[1].end);
	}

	if (dPtr) { // Store
		if (dSwi) {
			// Swizzle must be x or xyzw
			if (!/^(x|xyzw)$/.test(dSwi)) {
				return diag(`Store swizzle must be x or xyzw.`, DiagnosticSeverity.Error, operands[0].start, operands[1].end);
			}
		}
		if (sSwi) {
			if (!/^(x|xy|xyz|xyzw)$/.test(sSwi)) {
				return diag(`Store swizzle must be a sequential word swizzle starting at X.`, DiagnosticSeverity.Error, operands[0].start, operands[1].end);
			}
		}
	} else if (sPtr) { // Load
		if (sSwi) {
			// Swizzle must be x or xyzw
			if (!/^(x|xyzw)$/.test(sSwi)) {
				return diag(`Load swizzle must be x or xyzw.`, DiagnosticSeverity.Error, operands[0].start, operands[1].end);
			}
		}
		if (dSwi) {
			if (!/^(x|xy|xyz|xyzw)$/.test(dSwi)) {
				return diag(`Load swizzle must be a sequential word swizzle starting at X.`, DiagnosticSeverity.Error, operands[0].start, operands[1].end);
			}
		}
	} else {
		if (!swiMatch) {
			return diag(`Moves with swizzled registers must have the same swizzle.`, DiagnosticSeverity.Error, operands[0].start, operands[1].end);
		}
	}

	return null;
}
