import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { chop, diag } from '../validation';

export function parseNop(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	if (!instruction) return null;

	if (size !== undefined) {
		return diag(`Nop instruction does not take a size modifier, found ${size}`, DiagnosticSeverity.Error);
	}

	if (operands?.length !== 0) {
		return diag(`Nop takes no operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}

	return null;
}
