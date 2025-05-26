import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { chop, diag } from '../validation';
import { InstructionPart, operandTypeFromString } from '../parsing';

export function parseSet(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};
	if (!instruction) return null;

	if (size !== undefined) return diag(`Set instruction does not take a size modifier, found ${size}`, DiagnosticSeverity.Error);

	let expectedOperands = 2;
	switch (instruction.text) {
		case "set":
		case "set1":
			expectedOperands = 2;
			break;
		case "set2":
			expectedOperands = 3;
			break;
		case "set3":
			expectedOperands = 4;
			break;
		case "set4":
			expectedOperands = 5;
			break;
	}

	if (operands === undefined || operands === null)
		return diag(`Set instruction requires at least 1 operand.`, DiagnosticSeverity.Error);

	if (operands.length !== expectedOperands)
		return diag(`Set instruction "${instruction}" requires ${expectedOperands} operands, found ${operands.length}`, DiagnosticSeverity.Error);

	let dstType = operandTypeFromString(operands[0].text);

	if (dstType !== InstructionPart.Register)
		return diag(`Set instruction only accepts a writeable register as the first operand.`, DiagnosticSeverity.Error, operands[0].start, operands[0].end);

	for (let i = 1; i < operands.length; i++) {
		let srcType = operandTypeFromString(operands[i].text);

		if (srcType !== InstructionPart.Label && srcType !== InstructionPart.Immediate)
			return diag(`Set instructions only accept labels or immediate values as operands.`, DiagnosticSeverity.Error, operands[i].start, operands[i].end);
	}

	return null;
}
