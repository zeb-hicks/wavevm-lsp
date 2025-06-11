import { Diagnostic, Range, DiagnosticSeverity } from 'vscode-languageserver';

export enum InstructionType {
	Nop = "Nop",
	Sleep = "Sleep",
	Halt = "Halt",
	Skip = "Skip",
	MoveWord = "Move Word",
	SwapWord = "Swap Word",
	AddWord = "Add Word",
	SubtractWord = "Subtract Word",

	Move = "Move",

	Swizzle = "Swizzle",

	Add = "Add",
	AddSaturate = "Add Saturate",
	Subtract = "Subtract",
	SubtractSaturate = "Subtract Saturate",
	Equal = "Equal",
	NotEqual = "Not Equal",
	Carry = "Carry",
	LessThan = "Less Than",
	GreaterThan = "Greater Than",
	LessorEqual = "Less or Equal",
	GreaterorEqual = "Greater or Equal",
	AddOver = "Add Over",
	SubtractOver = "Subtract Over",
	ReverseSubtractOver = "Reverse Subtract Over",

	ShiftLeft = "Shift Left",
	ShiftRight = "Shift Right",
	ArithmeticShiftRight = "Arithmetic Shift Right",
	RotateLeft = "Rotate Left",
	RotateRight = "Rotate Right",

	BitwiseAnd = "And",
	BitwiseOr = "Or",
	BitwiseXor = "Xor",
	BitwiseNand = "Nand",
	BitwiseNor = "Nor",
	BitwiseXnor = "Xnor",
	BitwiseNotSrc = "Not Src",
	BitwiseNotDst = "Not Dest",
	BitwiseSrcAndNotDst = "Src And Not Dest",
	BitwiseNotSrcAndDst = "Not Src And Dest",
	BitwiseSrcOrNotDst = "Src Or Not Dest",
	BitwiseNotSrcOrDst = "Not Src Or Dest",
	BitwiseAll = "All",
	BitwiseOne = "One",
	BitwiseSwap = "Swap",

	HorizontalAdd = "Horizontal Add",
	MultiplySaturate = "Multiply Saturate",
	MultiplyLow = "Multiply Low",
	MultiplyHigh = "Multiply High",
	Divide = "Divide",
	ReciprocalDivide = "Reciprocal Divide",

	Set = "Set",
	Jump = "Jump",
	JumpEqual = "Jump if Equal",
	JumpNotEqual = "Jump if Not Equal",
}

export function instructionTypeStrings(type: InstructionType): string[] {
	switch (type) {
		case InstructionType.Nop: return ["nop"];
		case InstructionType.Sleep: return ["slp", "sleep"];
		case InstructionType.Halt: return ["hlt", "halt"];

		case InstructionType.Skip: return ["skip", "skip1", "skip2", "skip3", "skip4"];

		case InstructionType.MoveWord: return ["wmo", "wmov", "wmove"];
		case InstructionType.SwapWord: return ["wsw", "wswap"];
		case InstructionType.AddWord: return ["wad", "wadd"];
		case InstructionType.SubtractWord: return ["wsu", "wsub"];

		case InstructionType.Move: return ["mov", "move"];
		case InstructionType.Swizzle: return ["swi", "swizzle"];

		case InstructionType.Add: return ["add"];
		case InstructionType.AddSaturate: return ["adds"];
		case InstructionType.AddOver: return ["addo", "addover"];
		case InstructionType.Subtract: return ["sub"];
		case InstructionType.SubtractSaturate: return ["subs"];
		case InstructionType.SubtractOver: return ["subo", "subover"];
		case InstructionType.ReverseSubtractOver: return ["rsubo", "rsubover"];

		case InstructionType.Equal: return ["eq", "equ"];
		case InstructionType.NotEqual: return ["neq", "neq"];
		case InstructionType.Carry: return ["car", "cry", "carry"];
		case InstructionType.LessThan: return ["lt"];
		case InstructionType.GreaterThan: return ["gt"];
		case InstructionType.LessorEqual: return ["le", "lte"];
		case InstructionType.GreaterorEqual: return ["ge", "gte"];

		case InstructionType.ShiftLeft: return ["lsl", "asl"];
		case InstructionType.ShiftRight: return ["lsr"];
		case InstructionType.ArithmeticShiftRight: return ["asr"];
		case InstructionType.RotateLeft: return ["rol"];
		case InstructionType.RotateRight: return ["ror"];

		case InstructionType.BitwiseAnd: return ["and"];
		case InstructionType.BitwiseOr: return ["or"];
		case InstructionType.BitwiseXor: return ["xor"];
		case InstructionType.BitwiseNand: return ["nand"];
		case InstructionType.BitwiseNor: return ["nor"];
		case InstructionType.BitwiseXnor: return ["xnor"];

		case InstructionType.BitwiseNotSrc: return ["nsrc", "notsrc"];
		case InstructionType.BitwiseNotDst: return ["ndst", "notdst", "notdest"];

		case InstructionType.BitwiseSrcAndNotDst: return ["sand", "srcandnotdst"];
		case InstructionType.BitwiseSrcOrNotDst: return ["sond", "srcornotdst"];
		case InstructionType.BitwiseNotSrcAndDst: return ["nsad", "notsrcanddst"];
		case InstructionType.BitwiseNotSrcOrDst: return ["nsod", "notsrcordst"];

		case InstructionType.BitwiseAll: return ["all"];
		case InstructionType.BitwiseOne: return ["one"];
		case InstructionType.BitwiseSwap: return ["swap"];

		case InstructionType.HorizontalAdd: return ["hadd"];
		case InstructionType.MultiplySaturate: return ["mul", "mults", "multisat"];
		case InstructionType.MultiplyLow: return ["mlo", "multl", "multlow"];
		case InstructionType.MultiplyHigh: return ["mhi", "multh", "multhigh"];
		case InstructionType.Divide: return ["div", "divide"];
		case InstructionType.ReciprocalDivide: return ["rdiv", "rdivide"];

		case InstructionType.Set: return ["set", "set1", "set2", "set3", "set4"];
		case InstructionType.Jump: return ["jmp", "jump"];
		case InstructionType.JumpEqual: return ["je", "jeq", "jc", "jcp"];
		case InstructionType.JumpNotEqual: return ["jne", "jnc", "jcc"];

		default: return [];
	}
}

export function instructionTypeFromString(str: string): InstructionType | null {
	str = /(\w+)(\.\w+)?/.exec(str)?.[1] || str;
	switch (str.toLowerCase()) {
		case "nop": return InstructionType.Nop;
		case "slp":
		case "sleep": return InstructionType.Sleep;
		case "hlt":
		case "halt": return InstructionType.Halt;

		case "skip":
		case "skip1":
		case "skip2":
		case "skip3":
		case "skip4": return InstructionType.Skip;

		case "wmo":
		case "wmov":
		case "wmove": return InstructionType.MoveWord;
		case "wsw":
		case "wswap": return InstructionType.SwapWord;
		case "wad":
		case "wadd": return InstructionType.AddWord;
		case "wsu":
		case "wsub": return InstructionType.SubtractWord;

		case "mov":
		case "move": return InstructionType.Move;
		case "swi":
		case "swizzle": return InstructionType.Swizzle;

		case "add": return InstructionType.Add;
		case "adds": return InstructionType.AddSaturate;
		case "addo":
		case "addover": return InstructionType.AddOver;
		case "sub": return InstructionType.Subtract;
		case "subs": return InstructionType.SubtractSaturate;
		case "subo":
		case "subover": return InstructionType.SubtractOver;

		case "eq":
		case "equ": return InstructionType.Equal;
		case "ne":
		case "neq": return InstructionType.NotEqual;
		case "car":
		case "cry":
		case "carry": return InstructionType.Carry;
		case "lt": return InstructionType.LessThan;
		case "gt": return InstructionType.GreaterThan;
		case "le":
		case "lte": return InstructionType.LessorEqual;
		case "ge":
		case "gte": return InstructionType.GreaterorEqual;

		case "lsl":
		case "asl": return InstructionType.ShiftLeft;
		case "lsr": return InstructionType.ShiftRight;
		case "asr": return InstructionType.ArithmeticShiftRight;
		case "rol": return InstructionType.RotateLeft;
		case "ror": return InstructionType.RotateRight;

		case "and": return InstructionType.BitwiseAnd;
		case "or": return InstructionType.BitwiseOr;
		case "xor": return InstructionType.BitwiseXor;
		case "nand": return InstructionType.BitwiseNand;
		case "nor": return InstructionType.BitwiseNor;
		case "xnor": return InstructionType.BitwiseXnor;

		case "nsrc":
		case "notsrc": return InstructionType.BitwiseNotSrc;
		case "ndst":
		case "notdst":
		case "notdest": return InstructionType.BitwiseNotDst;
		case "sand":
		case "srcandnotdst": return InstructionType.BitwiseSrcAndNotDst;
		case "sond":
		case "srcornotdst": return InstructionType.BitwiseSrcOrNotDst;
		case "nsad":
		case "notsrcanddst": return InstructionType.BitwiseNotSrcAndDst;
		case "nsod":
		case "notsrcordst": return InstructionType.BitwiseNotSrcOrDst;
		case "all": return InstructionType.BitwiseAll;
		case "one": return InstructionType.BitwiseOne;
		case "swap": return InstructionType.BitwiseSwap;

		case "hadd": return InstructionType.HorizontalAdd;
		case "mul":
		case "mults":
		case "multisat": return InstructionType.MultiplySaturate;
		case "mlo":
		case "multl":
		case "multlow": return InstructionType.MultiplyLow;
		case "mhi":
		case "multh":
		case "multhigh": return InstructionType.MultiplyHigh;
		case "div":
		case "divide": return InstructionType.Divide;
		case "rdiv":
		case "rdivide": return InstructionType.ReciprocalDivide;

		case "set":
		case "set1":
		case "set2":
		case "set3":
		case "set4": return InstructionType.Set;

		case "jmp":
		case "jump": return InstructionType.Jump;

		case "je":
		case "jeq":
		case "jc":
		case "jcp": return InstructionType.JumpEqual;

		case "jne":
		case "jnc":
		case "jcc": return InstructionType.JumpNotEqual;

		default: return null;
	}
}

export function operandTypeFromString(str: string): InstructionPart | null {
	if (/^\[([rc][0-7]|ri)(\.[xyzw]{1,4})?\+\]$/.test(str)) return InstructionPart.PointerIncrement;
	if (/^\[([rc][0-7]|ri)(\.[xyzw]{1,4})?\]$/.test(str)) return InstructionPart.Pointer;
	if (/^[r][0-7i](\.[xyzw]{0,4})?$/.test(str)) return InstructionPart.Register;
	if (/^[c][0-7](\.[xyzw]{0,4})?$/.test(str)) return InstructionPart.Constant;
	if (/^\$?[0-9a-fA-F]+$/.test(str)) return InstructionPart.Immediate;
	if (/^:[0-9a-zA-Z_]+$/.test(str)) return InstructionPart.Label;
	return null;
}

export function stringifyOperand(str: string): string | null {
	let type = operandTypeFromString(str);
	let ls = str.toLowerCase();
	let {reg, swi} = /(?<reg>[rc][0-7]|ri)(?:\.(?<swi>[xyzw]{1,4}))?/.exec(ls)?.groups || {};
	// let reg;
	switch (type) {
		case InstructionPart.Constant:
			return `Constant Register \`${reg}\`${swi !== undefined ? ` word${swi.length > 1?"s":""} \`${swi}\`` : ""}`;
		case InstructionPart.Register:
			return `General Purpose Register \`${reg}\`${swi !== undefined ? ` word${swi.length > 1?"s":""} \`${swi}\`` : ""}`;
		case InstructionPart.Pointer:
			// reg = /([rc][0-7]|ri)/.exec(ls)?.[0];
			return `Memory at address of \`${reg}\``;
		case InstructionPart.PointerIncrement:
			// reg = /([rc][0-7]|ri)/.exec(ls)?.[0];
			return `Memory at address of \`${reg}\` which is incremented upon each read.`;
		case InstructionPart.Label:
			return `Value of Label \`${str}\``;
		case InstructionPart.Immediate:
			let val = parseImmediate(ls);
			return `Immediate value \`${ls}\` (${val})`
	}
	return null;
}

function parseImmediate(str: string): number {
	try {
		switch (str[0]) {
			case "$":
				return Number.parseInt(str.substring(1), 16);
			default:
				return Number.parseInt(str, 10);
		}
	} catch (e) {}
	return NaN;
}

export function operandTypeString(type: InstructionPart): string {
	switch (type) {
		case InstructionPart.Register: return "Register";
		case InstructionPart.Constant: return "Constant";
		case InstructionPart.Immediate: return "Immediate";
		case InstructionPart.Pointer: return "Pointer";
		case InstructionPart.PointerIncrement: return "Pointer Increment";
		case InstructionPart.Label: return "Label";
		default: return "Unknown Operand Type";
	}
}

export enum AssemblySyntaxContext {
	Root,

	Memory,
	Code,

	Instruction,
	InstructionSize,

	Register,
	RegisterSwizzle,
	RegisterPointer,

	Immediate,

	Comment
}

export function RegisterFromString(str: string): Register | null {
	switch (str.toLowerCase()) {
		case 'c0': return Register.c0;
		case 'c1': return Register.c1;
		case 'c2': return Register.c2;
		case 'c3': return Register.c3;
		case 'c4': return Register.c4;
		case 'c5': return Register.c5;
		case 'c6': return Register.c6;
		case 'c7': return Register.c7;
		case 'r0': return Register.r0;
		case 'r1': return Register.r1;
		case 'r2': return Register.r2;
		case 'r3': return Register.r3;
		case 'r4': return Register.r4;
		case 'r5': return Register.r5;
		case 'r6': return Register.r6;
		case 'r7': return Register.r7;
		case 'ri': return Register.ri;
		default: return null;
	}
}

export enum Register {
	c0 = 0,
	c1 = 1,
	c2 = 2,
	c3 = 3,
	c4 = 4,
	c5 = 5,
	c6 = 6,
	c7 = 7,
	r0 = 8,
	r1 = 9,
	r2 = 10,
	r3 = 11,
	r4 = 12,
	r5 = 13,
	r6 = 14,
	r7 = 15,
	ri = 15
}

export enum InstructionPart {
	Instruction,
	Size,
	Register,
	Constant,
	Immediate,
	Pointer,
	PointerIncrement,
	Label,
}

export function RegisterName(reg: Register): string {
	if (reg >= 0 && reg < 8) return `C${reg & 0x7}`;
	if (reg >= 0 && reg < 15) return `R${(reg >> 4) & 0x7}`;
	if (reg == Register.ri) return "Ri";
	return "Unknown Register";
}

export function RegisterLongName(reg: Register): string {
	if (reg >= 0 && reg < 8) return `Constant C${reg & 0x7}`;
	if (reg >= 0 && reg < 15) return `Register R${(reg >> 4) & 0x7}`;
	if (reg == Register.ri) return "Program Counter (Ri)";
	return "Unknown Register";
}
