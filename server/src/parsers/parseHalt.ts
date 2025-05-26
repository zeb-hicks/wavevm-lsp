import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { chop, diag } from '../validation';

export function parseHalt(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	if (!instruction) return null;

	if (size !== undefined) {
		return diag(`Halt instruction does not take a size modifier, found ${size}`, DiagnosticSeverity.Error);
	}

	if (operands?.length !== 0) {
		return diag(`Halt takes no operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}

	return null;
}
