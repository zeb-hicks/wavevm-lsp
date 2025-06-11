import { Diagnostic, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { InstructionType, instructionTypeFromString, operandTypeFromString } from '../parsing';
import { chop, diag, Span } from '../validation';

export function parseBitwise(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	return validateBitwise(instruction, size, operands);
}

function validateBitwise(instruction?: Span, size?: Span, operands?: Span[], comment?: Span): Diagnostic | null {
	if (!instruction) return null;

	if (size !== undefined)
		return diag(`Bitwise instruction does not take a size modifier: ${size.text}`, DiagnosticSeverity.Error);

	if (operands == null || operands.length === 0)
		return diag(`Bitwise instructions require at least 1 operand, found ${operands?.length || 0}`, DiagnosticSeverity.Error);

	let dstType = operandTypeFromString(operands[0].text);

	let inst = instructionTypeFromString(instruction.text);

	switch (inst) {
		case InstructionType.BitwiseAll:
		case InstructionType.BitwiseOne:
		case InstructionType.BitwiseNotDst:
			if (operands?.length !== 1)
				return diag(`Unary bitwise instructions require 1 operand, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
			break;
		default:
			if (operands?.length !== 2)
				return diag(`Bitwise instructions require 2 operands, found ${operands?.length || 0}`, DiagnosticSeverity.Error);
			let srcType = operandTypeFromString(operands[1].text);
	}

	return null;
}

export function stringifyBitwise(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (validateBitwise(instruction, size, operands, comment) == null) {
		let inst = instructionTypeFromString(instruction?.text || "");
		let unary = inst == InstructionType.BitwiseOne || inst == InstructionType.BitwiseAll || inst == InstructionType.BitwiseNotDst;
		return {
			kind: 'markdown',
			value: `# ${inst}\n\nPerforms the ${unary?"unary ":""}bitwise operation "${inst}"\n\n[Documentation](https://nimphio.us/wave2/w2s/instructions/bitwise.html#${inst?.toLowerCase().replace(" ", "-")})`
		}
	}
	return null;
}
