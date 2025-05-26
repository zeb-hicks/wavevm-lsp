import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { InstructionPart, InstructionType, operandTypeFromString } from './parsing';
import { parseNop } from './parsers/parseNop';
import { parseHalt } from './parsers/parseHalt';
import { parseSleep } from './parsers/parseSleep';
import { parseMove } from './parsers/parseMove';
import { parswWSelect } from './parsers/parswWSelect';
import { parseMath } from './parsers/parseMath';
import { parseSwizzle } from './parsers/parseSwizzle';
import { parseSkip } from './parsers/parseSkip';
import { parseShift } from './parsers/parseShift';
import { parseSpec } from './parsers/parseSpec';
import { parseSet } from './parsers/parseSet';
import { parseJump } from './parsers/parseJump';
import { parseJumpConditional } from './parsers/parseJumpConditional';

type ParserFunction = (text: string) => Diagnostic | null;

type Span = {
	start: number;
	end: number;
	text: string;
}

type ChoppedCodeLine = {
	instruction: Span;
	size?: Span;
	operands: Span[];
	comment?: Span;
}

export function diag(text: string, severity?: DiagnosticSeverity, start?: number, end?: number): Diagnostic {
	return {
		severity: severity || DiagnosticSeverity.Error,
		range: Range.create(0, start || 0, 0, end || 0),
		message: text,
		source: 'Wave2 Asm',
	}
}

export function chop(text: string): ChoppedCodeLine | null {
	let { code, comment } = /(?<code>[^;\n]*)(?<comment>;[^\n].*)?/.exec(text)?.groups ?? { code: text, comment: undefined };
	let codeStart = text.indexOf(code);
	let matches = /(?<inst>[^\s\.]+)(?<size>\.[\S]*)?(?<ws>\s*)(?<oper>.*)/.exec(code);
	let { inst, size, ws, oper } = matches?.groups ?? {};
	let operands: string[];
	if (oper !== undefined && oper.length > 0) {
		operands = oper.split(",");
	} else {
		operands = [];
	}

	let matchStart = codeStart + (matches?.index || 0);

	if (!inst) {
		return null;
	}

	let instSpan: Span = {
		start: matchStart,
		end: matchStart + inst.length,
		text: inst,
	}

	let sizeSpan: Span | undefined = undefined;
	if (size) {
		sizeSpan = {
			start: matchStart + inst.length,
			end: matchStart + inst.length + size.length,
			text: size,
		}
	}

	let operandsSpans: Span[] = [];
	let start = matchStart + inst.length + (size ? size.length : 0) + ws.length;
	for (let i = 0; i < operands.length; i++) {
		let operand = operands[i].trim();
		// let start = matchStart + inst.length + (size ? size.length : 0) + 1;
		let end = start + operand.length + 1;
		if (i > 0) {
			start += 1; // account for the comma
		}
		operandsSpans.push({
			start: start,
			end: end,
			text: operand,
		});
		start += operands[i].length + 1; // account for the comma
	}

	let commentSpan: Span | undefined = undefined;
	if (comment) {
		commentSpan = {
			start: text.indexOf(comment),
			end: text.length,
			text: comment,
		}
	}

	return {
		instruction: instSpan,
		size: sizeSpan,
		operands: operandsSpans,
		comment: commentSpan,
	}
}

export function validPart(operand: string, opType: InstructionPart): boolean {
	switch (opType) {
		case InstructionPart.Immediate:
			return /^(\$[a-fA-F0-9]+|[0-9]+)$/.test(operand);
		case InstructionPart.Register:
			return /^[r][0-7i](\.[xyzw])?$/.test(operand);
		case InstructionPart.Constant:
			return /^[c][0-7](\.[xyzw])?$/.test(operand);
		case InstructionPart.Size:
			return /^\.[bw]$/.test(operand);
		case InstructionPart.Pointer:
			return /^\[([rc][0-7]|ri)(\.[xyzw]{1,4})?\]$/.test(operand);
		case InstructionPart.PointerIncrement:
			return /^\[([rc][0-7]|ri)(\.[xyzw]{1,4})?\+?\]$/.test(operand);
		case InstructionPart.Label:
			return /^:[a-zA-Z0-9_]*$/.test(operand);
	}
	return false;
}

function __ni__(text: string): Diagnostic | null {
	return diag(`Parser not implemented for instruction: ${text}`, DiagnosticSeverity.Information);
}

export function validSize(size?: string): Diagnostic | null {
	if (size === undefined) return diag(`Invalid size modifier. Expected .b or .w`, DiagnosticSeverity.Error);

	return null;
}

function parseBitwise(text: string): Diagnostic | null {
	let { instruction, size, operands, comment } = chop(text) || {};
	if (!instruction) return null;

	if (size !== undefined)
		return diag(`Bitwise instruction does not take a size modifier: ${size.text}`, DiagnosticSeverity.Error);

	if (operands == null || operands.length === 0)
		return diag(`Bitwise instructions require at least 1 operand, found ${operands?.length || 0}`, DiagnosticSeverity.Error);

	let dstType = operandTypeFromString(operands[0].text);

	switch (instruction.text) {
		case "all":
		case "one":
		case "notdst":
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

export const ParserForInstruction: Record<InstructionType, ParserFunction> = {
	[InstructionType.Nop]: parseNop,
	[InstructionType.Sleep]: parseSleep,
	[InstructionType.Halt]: parseHalt,
	[InstructionType.Skip]: parseSkip,

	[InstructionType.MoveWord]: parswWSelect,
	[InstructionType.SwapWord]: parswWSelect,
	[InstructionType.AddWord]: parswWSelect,
	[InstructionType.SubtractWord]: parswWSelect,

	[InstructionType.Move]: parseMove,

	[InstructionType.Swizzle]: parseSwizzle,

	[InstructionType.Add]: parseMath,
	[InstructionType.AddSaturate]: parseMath,
	[InstructionType.Subtract]: parseMath,
	[InstructionType.SubtractSaturate]: parseMath,
	[InstructionType.Equal]: parseMath,
	[InstructionType.NotEqual]: parseMath,
	[InstructionType.Carry]: parseMath,
	[InstructionType.LessThan]: parseMath,
	[InstructionType.GreaterThan]: parseMath,
	[InstructionType.LessorEqual]: parseMath,
	[InstructionType.GreaterorEqual]: parseMath,
	[InstructionType.AddOver]: parseMath,
	[InstructionType.SubtractOver]: parseMath,
	[InstructionType.ReverseSubtractOver]: parseMath,

	[InstructionType.ShiftLeft]: parseShift,
	[InstructionType.ShiftRight]: parseShift,
	[InstructionType.ArithmeticShiftRight]: parseShift,
	[InstructionType.RotateLeft]: parseShift,
	[InstructionType.RotateRight]: parseShift,

	[InstructionType.BitwiseAnd]: parseBitwise,
	[InstructionType.BitwiseOr]: parseBitwise,
	[InstructionType.BitwiseXor]: parseBitwise,
	[InstructionType.BitwiseNand]: parseBitwise,
	[InstructionType.BitwiseNor]: parseBitwise,
	[InstructionType.BitwiseXnor]: parseBitwise,
	[InstructionType.BitwiseNotSrc]: parseBitwise,
	[InstructionType.BitwiseNotDst]: parseBitwise,
	[InstructionType.BitwiseSrcAndNotDst]: parseBitwise,
	[InstructionType.BitwiseNotSrcAndDst]: parseBitwise,
	[InstructionType.BitwiseSrcOrNotDst]: parseBitwise,
	[InstructionType.BitwiseNotSrcOrDst]: parseBitwise,
	[InstructionType.BitwiseAll]: parseBitwise,
	[InstructionType.BitwiseOne]: parseBitwise,
	[InstructionType.BitwiseSwap]: parseBitwise,

	[InstructionType.HorizontalAdd]: parseSpec,
	[InstructionType.MultiplySaturate]: parseSpec,
	[InstructionType.MultiplyLow]: parseSpec,
	[InstructionType.MultiplyHigh]: parseSpec,
	[InstructionType.Divide]: parseSpec,
	[InstructionType.ReciprocalDivide]: parseSpec,

	[InstructionType.Set]: parseSet,
	[InstructionType.Jump]: parseJump,
	[InstructionType.JumpConditional]: parseJumpConditional,
};
