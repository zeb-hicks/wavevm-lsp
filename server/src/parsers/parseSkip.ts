import { Diagnostic, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { chop, diag, Span } from '../validation';

export function parseSkip(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateSkip(text, instruction, size, operands, comment);
}

export function validateSkip(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {

	if (!instruction) return null;

	if (size !== undefined) {
		return diag(`Unexpected size specifier.`, DiagnosticSeverity.Error, size.start, size.end);
	}

	if (operands !== undefined && operands.length !== 0) {
		return diag(`Skip does not take operands.`, DiagnosticSeverity.Error, operands[0].start, operands[operands.length - 1].end);
	}

	return null;
}

export function stringifySkip(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateSkip(text, instruction, size, operands, comment) == null) {
		return {
			kind: "markdown",
			value: `# Skip\n\nAdvances the program counter by a specified amount.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/move.html#skip)`
		};
	}
	return null;
}
