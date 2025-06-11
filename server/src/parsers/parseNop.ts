import { Diagnostic, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { chop, diag, Span } from '../validation';

export function parseNop(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateNop(text, instruction, size, operands, comment);
}

export function validateNop(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {

	if (!instruction) return null;

	if (size !== undefined) {
		return diag(`Nop instruction does not take a size modifier, found ${size}`, DiagnosticSeverity.Error);
	}

	if (operands?.length !== 0) {
		return diag(`Nop takes no operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}

	return null;
}

export function stringifyNop(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateNop(text, instruction, size, operands, comment) == null) {
		return {
			kind: "markdown",
			value: `# Nop\n\nEquivalent to sleep for 0 ticks.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/system.html#nop)`
		};
	}
	return null;
}
