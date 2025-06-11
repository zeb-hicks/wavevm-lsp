import { Diagnostic, DiagnosticSeverity, MarkupContent, Range } from 'vscode-languageserver';
import { InstructionPart, InstructionType } from './parsing';
import { parseNop, stringifyNop } from './parsers/parseNop';
import { parseHalt, stringifyHalt } from './parsers/parseHalt';
import { parseSleep, stringifySleep } from './parsers/parseSleep';
import { parseMove, stringifyMove } from './parsers/parseMove';
import { parseWSelect, stringifyWSelect } from './parsers/parseWSelect';
import { parseMath, stringifyMath } from './parsers/parseMath';
import { parseSwizzle, stringifySwizzle } from './parsers/parseSwizzle';
import { parseSkip, stringifySkip } from './parsers/parseSkip';
import { parseShift, stringifyShift } from './parsers/parseShift';
import { parseSpec, stringifySpec } from './parsers/parseSpec';
import { parseSet, stringifySet } from './parsers/parseSet';
import { parseJump, stringifyJump } from './parsers/parseJump';
import { parseJumpConditional, stringifyJumpConditional } from './parsers/parseJumpConditional';
import { parseBitwise, stringifyBitwise } from './parsers/parseBitwise';

type ParserFunction = (text: string) => Diagnostic | null;
type MarkdownFunction = (text: string, instruction?: Span, size?: Span, operands?: Span[], comment?: Span) => MarkupContent | null;

export type Span = {
	start: number;
	end: number;
	text: string;
}

export type ChoppedCodeLine = {
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

export const ParserForInstruction: Record<InstructionType, ParserFunction> = {
	[InstructionType.Nop]: parseNop,
	[InstructionType.Sleep]: parseSleep,
	[InstructionType.Halt]: parseHalt,
	[InstructionType.Skip]: parseSkip,

	[InstructionType.MoveWord]: parseWSelect,
	[InstructionType.SwapWord]: parseWSelect,
	[InstructionType.AddWord]: parseWSelect,
	[InstructionType.SubtractWord]: parseWSelect,

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
	[InstructionType.JumpEqual]: parseJumpConditional,
	[InstructionType.JumpNotEqual]: parseJumpConditional,
};

export const HoverDocForInstruction: Record<InstructionType, MarkdownFunction> = {
	[InstructionType.Nop]: stringifyNop,
	[InstructionType.Sleep]: stringifySleep,
	[InstructionType.Halt]: stringifyHalt,
	[InstructionType.Skip]: stringifySkip,

	[InstructionType.MoveWord]: stringifyWSelect,
	[InstructionType.SwapWord]: stringifyWSelect,
	[InstructionType.AddWord]: stringifyWSelect,
	[InstructionType.SubtractWord]: stringifyWSelect,

	[InstructionType.Move]: stringifyMove,

	[InstructionType.Swizzle]: stringifySwizzle,

	[InstructionType.Add]: stringifyMath,
	[InstructionType.AddSaturate]: stringifyMath,
	[InstructionType.Subtract]: stringifyMath,
	[InstructionType.SubtractSaturate]: stringifyMath,
	[InstructionType.Equal]: stringifyMath,
	[InstructionType.NotEqual]: stringifyMath,
	[InstructionType.Carry]: stringifyMath,
	[InstructionType.LessThan]: stringifyMath,
	[InstructionType.GreaterThan]: stringifyMath,
	[InstructionType.LessorEqual]: stringifyMath,
	[InstructionType.GreaterorEqual]: stringifyMath,
	[InstructionType.AddOver]: stringifyMath,
	[InstructionType.SubtractOver]: stringifyMath,
	[InstructionType.ReverseSubtractOver]: stringifyMath,

	[InstructionType.ShiftLeft]: stringifyShift,
	[InstructionType.ShiftRight]: stringifyShift,
	[InstructionType.ArithmeticShiftRight]: stringifyShift,
	[InstructionType.RotateLeft]: stringifyShift,
	[InstructionType.RotateRight]: stringifyShift,

	[InstructionType.BitwiseAnd]: stringifyBitwise,
	[InstructionType.BitwiseOr]: stringifyBitwise,
	[InstructionType.BitwiseXor]: stringifyBitwise,
	[InstructionType.BitwiseNand]: stringifyBitwise,
	[InstructionType.BitwiseNor]: stringifyBitwise,
	[InstructionType.BitwiseXnor]: stringifyBitwise,
	[InstructionType.BitwiseNotSrc]: stringifyBitwise,
	[InstructionType.BitwiseNotDst]: stringifyBitwise,
	[InstructionType.BitwiseSrcAndNotDst]: stringifyBitwise,
	[InstructionType.BitwiseNotSrcAndDst]: stringifyBitwise,
	[InstructionType.BitwiseSrcOrNotDst]: stringifyBitwise,
	[InstructionType.BitwiseNotSrcOrDst]: stringifyBitwise,
	[InstructionType.BitwiseAll]: stringifyBitwise,
	[InstructionType.BitwiseOne]: stringifyBitwise,
	[InstructionType.BitwiseSwap]: stringifyBitwise,

	[InstructionType.HorizontalAdd]: stringifySpec,
	[InstructionType.MultiplySaturate]: stringifySpec,
	[InstructionType.MultiplyLow]: stringifySpec,
	[InstructionType.MultiplyHigh]: stringifySpec,
	[InstructionType.Divide]: stringifySpec,
	[InstructionType.ReciprocalDivide]: stringifySpec,

	[InstructionType.Set]: stringifySet,
	[InstructionType.Jump]: stringifyJump,
	[InstructionType.JumpEqual]: stringifyJumpConditional,
	[InstructionType.JumpNotEqual]: stringifyJumpConditional,
};
