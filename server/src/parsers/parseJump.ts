import { Diagnostic, DiagnosticSeverity, MarkupContent, MarkupKind } from 'vscode-languageserver';
import { chop, diag, Span } from '../validation';
import { InstructionPart, operandTypeFromString } from '../parsing';

export function parseJump(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateJump(instruction, size, operands, comment);
}

function validateJump(instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {
	if (!instruction) return null;

	if (size !== undefined)
		return diag(`Jump instruction does not take a size modifier, found ${size}`, DiagnosticSeverity.Error, size.start, size.end);

	if (operands === undefined || operands.length === 0)
		return diag(`Jump instruction requires at least 1 operand`, DiagnosticSeverity.Error, operands?.[0]?.start, operands?.[operands.length - 1]?.end);

	if (operands.length != 1)
		return diag(`Jump instructions require 1 operand, found ${operands?.length || 0}`, DiagnosticSeverity.Error, operands[0].start, operands[operands.length - 1].end);

	let dstType = operandTypeFromString(operands[0].text);

	if (dstType === null)
		return diag(`Invalid operand: ${operands[0].text}`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);

	if (dstType !== InstructionPart.Label && dstType !== InstructionPart.Immediate)
		return diag(`Jump destination must be a label or immediate, found ${dstType}`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);

	return null;
}

export function stringifyJump(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateJump(instruction, size, operands, comment) == null) {
		return {
			kind: "markdown",
			value: `# Jump\n\nJump to the specified address or label.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/macros/jump.html)`
		};
	}
	return null;
}
