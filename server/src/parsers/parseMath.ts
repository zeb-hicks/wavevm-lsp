import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { operandTypeFromString } from '../parsing';
import { chop, diag } from '../validation';

export function parseMath(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	if (!instruction) return null;

	if (operands?.length !== 3) {
		return diag(`Math instructions require 3 operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}

	let dstType = operandTypeFromString(operands[0].text);
	let lhsType = operandTypeFromString(operands[1].text);
	let rhsType = operandTypeFromString(operands[2].text);
	let { dOp, dSwi } = /\b(?<dOp>\w+)(?:\.(?<dSwi>\w+))?\b/.exec(operands[0].text)?.groups ?? {};
	let { lOp, lSwi } = /\b(?<lOp>\w+)(?:\.(?<lSwi>\w+))?\b/.exec(operands[1].text)?.groups ?? {};
	let { rOp, rSwi } = /\b(?<rOp>\w+)(?:\.(?<rSwi>\w+))?\b/.exec(operands[2].text)?.groups ?? {};

	if (dSwi !== undefined) return diag(`Math operands cannot be swizzled.`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	if (lSwi !== undefined) return diag(`Math operands cannot be swizzled.`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);
	if (rSwi !== undefined) return diag(`Math operands cannot be swizzled.`, DiagnosticSeverity.Error, operands[2].start, operands[2].end);

	// TODO: Validate math properly
	return null;
}
