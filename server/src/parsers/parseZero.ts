import { Diagnostic, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { chop, diag, Span, validPart } from '../validation';
import { InstructionPart } from '../parsing.js';

export function parseZero(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateZero(instruction, size, operands, comment);
}

function validateZero(instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {
	if (!instruction) return null;

	if (size !== undefined) {
		return diag(`Zero instruction does not take a size modifier, found ${size}`, DiagnosticSeverity.Error);
	}

	if (operands?.length !== 1) {
		return diag(`Zero takes 1 operand, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}

	let isRegister = validPart(operands[0].text, InstructionPart.Register);

	if (!isRegister) {
		let start = operands[0].start;
		let end = operands[0].end;
		return diag(`Zero requires a valid register to zero, got ${operands[0].text}`, DiagnosticSeverity.Error, start, end);
	}

	return null;
}

export function stringifyZero(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateZero(instruction, size, operands, comment) == null) {
		return {
			kind: "markdown",
			value: `# Zero\n\nSet a register value to 0.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/math.html#Zero)`
		};
	}
	return null;
}
