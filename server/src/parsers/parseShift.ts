import { Diagnostic, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { operandTypeFromString, InstructionPart } from '../parsing';
import { chop, validSize, diag, Span } from '../validation';

export function parseShift(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateShift(text, instruction, size, operands, comment);
}

export function validateShift(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {
	if (!instruction) return null;

	let diagSize = validSize(size?.text);
	if (diagSize) return diagSize;

	if (operands?.length !== 2) {
		return diag(`Shift instructions require 2 operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}

	let dstType = operandTypeFromString(operands[0].text);
	let srcType = operandTypeFromString(operands[1].text);

	if (dstType === null) return diag(`Invalid destination operand for shift instruction: ${operands[0].text}`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	if (srcType === null) return diag(`Invalid source operand for shift instruction: ${operands[1].text}`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);

	if (dstType !== InstructionPart.Register) return diag(`Shift instruction destination must be a register.`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	if (srcType !== InstructionPart.Register && srcType !== InstructionPart.Immediate && srcType !== InstructionPart.Constant)
		return diag(`Shift instruction source must be a register or immediate value.`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);

	return null;
}

export function stringifyShift(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateShift(text, instruction, size, operands, comment) == null) {
		return {
			kind: "markdown",
			value: `# Shift\n\nPerforms the specified bitwise shift operation.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/shift.html)`
		};
	}
	return null;
}
