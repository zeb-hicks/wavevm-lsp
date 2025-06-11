import { Diagnostic, DiagnosticSeverity, MarkupContent, MarkupKind } from 'vscode-languageserver';
import { InstructionPart } from '../parsing';
import { chop, diag, Span, validPart } from '../validation';

export function parseSleep(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	if (!instruction) return null;

	let sized = false;
	if (size !== undefined) {
		switch (size.text) {
			case ".w":
			case ".h":
			case ".l":
				sized = true;
				break;
			default:
				let start = size?.start || 0;
				let end = size?.end || instruction.end;
				return diag(`Invalid size, expected .w, .h, or .l`, DiagnosticSeverity.Error, start, end);
		}
	}

	if (operands?.length !== 1) {
		let start = operands?.[0]?.start || 0;
		let end = text.length - (comment?.text.length || 0);
		return diag(`Sleep takes 1 operand, found ${operands?.length || 0}`, DiagnosticSeverity.Error, start, end);
	}

	let isRegister = validPart(operands[0].text, InstructionPart.Register) || validPart(operands[0].text, InstructionPart.Constant);

	if (sized && !isRegister) {
		let start = operands[0].start;
		let end = operands[0].end;
		return diag(`Sleep with a size requires a register, got ${operands[0].text}`, DiagnosticSeverity.Error, start, end);
	}

	if (!sized && isRegister) {
		let start = instruction.end;
		let end = start + 1;
		return diag(`Size required when using a register as a duration source.`, DiagnosticSeverity.Error, start, end);
	}

	if (!validPart(operands[0].text, InstructionPart.Immediate) && !isRegister) {
		let start = operands[0].start;
		let end = operands[0].end;
		return diag(`Expected valid number, got ${operands[0].text}`, DiagnosticSeverity.Error, start, end);
	}

	return null;
}

export function stringifySleep(text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span): MarkupContent | null {
	if (instruction === undefined) return null;
	if (operands === undefined) return null;
	if (parseSleep(text) === null && operands !== undefined) {
		if (size !== undefined) {
			let part = {
				".w": "first word",
				".h": "high byte of the first word",
				".l": "low byte of the first word",
			}[size.text];
			let reg = operands[0].text;
			return {
				kind: MarkupKind.Markdown,
				value: `# Sleep\n\nSleep for the number of ticks stored in ${part} of the \`${reg}\` register.`
			}
		} else {
			return {
				kind: MarkupKind.Markdown,
				value: `# Sleep\n\nSleep for \`${operands[0].text}\` ticks.`
			}
		}
	}
	return null;
}
