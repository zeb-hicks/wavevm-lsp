import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { operandTypeFromString, InstructionPart, operandTypeString } from '../parsing';
import { chop, diag } from '../validation';

export function parseSwizzle(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};
	if (!instruction) return null;
	if (size !== undefined) {
		return diag(`Swizzle instruction does not take a size modifier: ${size}`, DiagnosticSeverity.Error);
	}
	if (operands?.length !== 1) {
		return diag(`Swizzle instructions require 1 operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}
	let dstType = operandTypeFromString(operands[0].text);
	let { dOp, dSwi } = /\b(?<dOp>\w+)(?:\.(?<dSwi>[xyzw]+))?\b/.exec(operands[0].text)?.groups ?? {};
	if (dSwi === undefined) return diag(`Missing swizzle.`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	switch (dstType) {
		case InstructionPart.Register:
			if (dSwi.length !== 4) return diag(`Swizzle destination must be a four-word swizzle. ${operandTypeString(dstType as InstructionPart)}`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
			return null;
		default:
			return diag(`Swizzle destination must be a writeable register, found ${operandTypeString(dstType as InstructionPart)}`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	}
}
