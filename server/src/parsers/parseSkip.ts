import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { chop, diag } from '../validation';

export function parseSkip(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	if (!instruction) return null;

	if (size !== undefined) {
		return diag(`Unexpected size specifier.`, DiagnosticSeverity.Error, size.start, size.end);
	}

	if (operands !== undefined && operands.length !== 0) {
		return diag(`Skip does not take operands.`, DiagnosticSeverity.Error, operands[0].start, operands[operands.length - 1].end);
	}

	return null;
}
