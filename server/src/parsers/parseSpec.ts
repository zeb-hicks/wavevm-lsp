import { Diagnostic, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { operandTypeFromString, InstructionPart } from '../parsing';
import { chop, diag, Span } from '../validation';

export function parseSpec(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateSpec(text, instruction, size, operands, comment);
}

export function validateSpec(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {
	if (!instruction) return null;

	// Two operaands, no swizzle, first register must be writeable
	if (size !== undefined)
		return diag(`Special operations do not take a size, found: ${size.text}`, DiagnosticSeverity.Error);

	if (operands?.length !== 2)
		return diag(`Requires 2 operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);

	let dstType = operandTypeFromString(operands[0].text);
	let srcType = operandTypeFromString(operands[1].text);

	if (dstType !== InstructionPart.Register)
		return diag(`Destination must be a writeable register, found ${operands[0].text}`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);

	if (srcType !== InstructionPart.Register && srcType !== InstructionPart.Constant)
		return diag(`Source must be a register, found ${operands[1].text}`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);

	let { sOp, sSwi } = /\b(?<sOp>\w+)(?:\.(?<sSwi>\w+))?\b/.exec(operands[1].text)?.groups ?? {};
	let { dOp, dSwi } = /\b(?<dOp>\w+)(?:\.(?<dSwi>\w+))?\b/.exec(operands[0].text)?.groups ?? {};

	if (dSwi !== undefined) return diag(`Special operation destinations cannot be swizzled.`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	if (sSwi !== undefined) return diag(`Special operation sources cannot be swizzled.`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);

	return null;
}

export function stringifySpec(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateSpec(text, instruction, size, operands, comment) == null) {
		return {
			kind: "markdown",
			value: `# Special: ${instruction?.text}\n\nSpecial instruction.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/special.html)`
		};
	}
	return null;
}
