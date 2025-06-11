import { Diagnostic, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { InstructionPart, operandTypeFromString } from '../parsing';
import { chop, diag, Span, validSize } from '../validation';

export function parseMath(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateMath(text, instruction, size, operands, comment);
}

export function validateMath(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {
	if (!instruction) return null;

	let diagSize = validSize(size?.text);
	if (diagSize) return diagSize;

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

	if (dstType !== InstructionPart.Register) return diag(`Math destination must be a writable register.`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	if (lhsType !== InstructionPart.Register && lhsType !== InstructionPart.Constant) return diag(`Math operands must be registers or constants.`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);
	if (rhsType !== InstructionPart.Register && rhsType !== InstructionPart.Constant) return diag(`Math operands must be registers or constants.`, DiagnosticSeverity.Error, operands[2].start, operands[2].end);

	if (dOp !== lOp && dOp !== rOp) return diag(`Math destination must also be included in the calculation.`, DiagnosticSeverity.Error, operands[0].start, operands[2].end);

	return null;
}

export function stringifyMath(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateMath(text, instruction, size, operands, comment) == null) {
		return {
			kind: "markdown",
			value: `# Math\n\nPerforms the specified math operation.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/math.html)`
		};
	}
	return null;
}
