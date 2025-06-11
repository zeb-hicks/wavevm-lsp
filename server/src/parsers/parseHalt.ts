import { Diagnostic, DiagnosticSeverity, DiagnosticTag, MarkupContent, MarkupKind } from 'vscode-languageserver';
import { chop, diag, Span } from '../validation';

export function parseHalt(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateHalt(instruction, size, operands, comment);
}

function validateHalt(instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {
	if (!instruction) return null;

	if (size !== undefined) {
		return diag(`Halt instruction does not take a size modifier, found ${size}`, DiagnosticSeverity.Error);
	}

	if (operands?.length !== 0) {
		return diag(`Halt takes no operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}

	return null;
}

export function stringifyHalt(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateHalt(instruction, size, operands, comment) == null) {
		return {
			kind: "markdown",
			value: `# Halt\n\nHalt the current core.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/system.html#halt)`
		};
	}
	return null;
}
