import { Diagnostic, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { chop, diag, Span } from '../validation';
import { InstructionPart, InstructionType, instructionTypeFromString, operandTypeFromString } from '../parsing';

export function parseJumpConditional(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateJumpConditional(text, instruction, size, operands, comment);
}

export function validateJumpConditional(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {
	if (!instruction) return null;

	if (size !== undefined)
		return diag(`Jump instruction does not take a size modifier, found ${size}`, DiagnosticSeverity.Error, size.start, size.end);

	if (operands === undefined || operands.length === 0)
		return diag(`Conditional jump expects 2 operands`, DiagnosticSeverity.Error, operands?.[0]?.start, operands?.[operands.length - 1]?.end);

	if (operands.length != 2)
		return diag(`Conditional jump expects 2 operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error, operands[0].start, operands[operands.length - 1].end);

	let srcType = operandTypeFromString(operands[0].text);
	let dstType = operandTypeFromString(operands[1].text);

	if (srcType === null)
		return diag(`Invalid source operand: ${operands[0].text} - Expected a register.`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);
	if (dstType === null)
		return diag(`Invalid jump destination: ${operands[0].text} - Expected a constant or a label.`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);

	if (srcType !== InstructionPart.Register && srcType !== InstructionPart.Constant)
		return diag(`Conditional jump source must be a register, found ${srcType}`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);

	if (dstType !== InstructionPart.Label && dstType !== InstructionPart.Immediate)
		return diag(`Jump destination must be a label or immediate, found ${dstType}`, DiagnosticSeverity.Error, operands[1].start, operands[1].end);

	return null;
}

export function stringifyJumpConditional(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateJumpConditional(text, instruction, size, operands, comment) == null) {
		let inst = instructionTypeFromString(instruction?.text || "");
		let neq = inst == InstructionType.JumpNotEqual;
		let reg = (operands || [{text:"ERR"}])[0].text;
		return {
			kind: "markdown",
			value: `# Jump if ${neq?"Not Equal":"Equal"}\n\nJump to the specified address or label if ${reg} is ${neq?"0xffff":"0x0000"}.\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/macros/jump.html)`
		};
	}
	return null;
}
