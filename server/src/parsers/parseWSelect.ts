import { Diagnostic, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { operandTypeFromString, InstructionPart } from '../parsing';
import { chop, diag, Span } from '../validation';

export function parseWSelect(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateWSelect(text, instruction, size, operands, comment);
}

export function validateWSelect(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {

	if (!instruction) return null;

	if (size !== undefined) {
		return diag(`MoveWord instruction does not take a size modifier: ${size}`, DiagnosticSeverity.Error);
	}

	if (operands?.length !== 2) {
		return diag(`WordSelect instructions require 2 operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
	}

	let dstType = operandTypeFromString(operands[0].text);
	let srcType = operandTypeFromString(operands[1].text);

	if (dstType !== InstructionPart.Register) return diag(`WordSelect destination must be a register.`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	if (srcType !== InstructionPart.Register && srcType !== InstructionPart.Constant) return diag(`WordSelect source must be register with a single word swizzle.`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);

	let { sOp, sSwi } = /\b(?<sOp>\w+)(?:\.(?<sSwi>\w+))?\b/.exec(operands[1].text)?.groups ?? {};
	let { dOp, dSwi } = /\b(?<dOp>\w+)(?:\.(?<dSwi>\w+))?\b/.exec(operands[0].text)?.groups ?? {};

	if (dSwi !== undefined) return diag(`Word Select instruction destinations cannot be swizzled.`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);

	if (sSwi !== undefined && sSwi !== "" && !/^[xyzw]$/.test(sSwi)) {
		return diag(`Word Select instruction source swizzle must be exactly one word.`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);
	}

	return null;
}

export function stringifyWSelect(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateWSelect(text, instruction, size, operands, comment) == null) {
		return {
			kind: "markdown",
			value: `# Halt\n\nHalt the current core.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/system.html#halt)`
		};
	}
	return null;
}
