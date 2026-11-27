/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	DocumentDiagnosticReportKind,
	type DocumentDiagnosticReport,
	Range,
	MarkupContent,
	Position,
	HoverRequest,
	HoverParams,
	Hover,
	WorkspaceEdit,
	RenameRequest,
	TextDocumentIdentifier,
	TextDocumentEdit,
	VersionedTextDocumentIdentifier,
	FoldingRangeRequest,
	FoldingRange,
	FoldingRangeKind} from 'vscode-languageserver/node';

// import {
// 	MarkdownString
// } from "vscode";

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { AssemblySyntaxContext, InstructionPart, InstructionType, instructionTypeFromString, instructionTypeStrings, stringifyOperand } from './parsing';
import { chop, HoverDocForInstruction, Span } from './validation';
import { assemble } from './assembler';
import { InlineCompletionFeature } from 'vscode-languageserver/lib/common/inlineCompletion.proposed.js';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type);
		connection.client.register(HoverRequest.type);
		connection.client.register(RenameRequest.type);
		connection.client.register(FoldingRangeRequest.type);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface Wave2LSPSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: Wave2LSPSettings = { maxNumberOfProblems: 1000 };
let globalSettings: Wave2LSPSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings = new Map<string, Thenable<Wave2LSPSettings>>();

connection.onFoldingRanges((params) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;

	let ranges: FoldingRange[] = [];
	let lines = doc.getText().split('\n');

	let current = -1;
	let current_text = "";

	for (let i = 0; i < lines.length; i++) {
		let label = /(?<label>\.code|\.memory)/gi.exec(lines[i])?.groups?.label;
		if (label) {
			if (current == -1) {
				// First fold region start
				current = i;
				current_text = label;
			} else if (current < i) {
				// Found the end of the region, add a fold range
				ranges.push({
					startLine: current,
					endLine: i - 1,
					kind: FoldingRangeKind.Region,
					collapsedText: current_text
				});
				current = i;
				current_text = label;
			}
		}
	}
	if (current != -1) {
		ranges.push({
			startLine: current,
			endLine: lines.length - 1,
			kind: FoldingRangeKind.Region,
			collapsedText: current_text
		});
	}

	return ranges;
});

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = (
			(change.settings.wave2lsp || defaultSettings)
		);
	}
	// Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
	// We could optimize things here and re-fetch the setting first can compare it
	// to the existing setting, but this is out of scope for this example.
	connection.languages.diagnostics.refresh();
});

connection.onHover((hover: HoverParams): Hover | null => {
	let doc = documents.get(hover.textDocument.uri);
	if (doc) {
		let line_range = Range.create(hover.position.line, 0, hover.position.line + 1, 0);
		let line_text = doc.getText(line_range);
		let { md, span } = makeHoverText(line_text, hover.position.character) || {};
		if (md && span) {
			let range = Range.create(line_range.start.line, line_range.start.character + span?.start, line_range.start.line, span?.end);
			return {
				contents: md,
				range: range
			}
		}
	}
	return null;
});

function inflateAt(document: TextDocument, position: Position, test: RegExp): Range {
	if (!document) return Range.create(position, position);
	let l = position.line;
	let c = position.character;
	let range = Range.create(l, c, l, c);
	let testRange = Range.create(l, c - 1, l, c);
	let lim = 256;
	while (lim-- > 0 && test.test(document.getText(testRange))) {
		range.start.character--;
		testRange.start.character--;
		testRange.end.character--;
	}
	lim = 256;
	testRange = Range.create(l, c, l, c + 1);
	while (lim-- > 0 && test.test(document.getText(testRange))) {
		if (document.getText(testRange) == '\n') {
			break;
		}
		range.end.character++;
		testRange.start.character++;
		testRange.end.character++;
	}
	return range;
}

// connection.onRenameRequest((rename): WorkspaceEdit | null => {;
// 	let doc = documents.get(rename.textDocument.uri);
// 	if (!doc) return null;
// 	let range = inflateAt(doc, rename.position, /[:a-zA-Z0-9]/);
// 	let rangeText = documents.get(rename.textDocument.uri)?.getText(range);
// 	console.log("Rename request:", rename.position, rename.newName, range, rangeText);

// 	let doc_text = doc.getText();
// 	let lines = doc_text.split('\n');
// 	let edits: TextDocumentEdit[] = [];
// 	for (let line in lines) {
// 		edits.push({
// 			textDocument: vdoc,
// 			edits: [

// 			]
// 		})
// 	}

// 	let vdoc: VersionedTextDocumentIdentifier = {
// 		uri: rename.textDocument.uri,
// 		version: 1,
// 	}
// 	let wsedit: WorkspaceEdit = {
// 		documentChanges: [{
// 			edits: [
// 				{
// 					annotationId: "rename",
// 					newText: rename.newName,
// 					range: range
// 				}
// 			],
// 			textDocument: vdoc,
// 		}],

// 	}

// 	return null;
// });

type MarkupAndSpan = {
	md: MarkupContent,
	span: Span
}

function makeHoverText(text: string, pos: number): MarkupAndSpan | null {
	let { instruction, size, operands, comment } = chop(text) || {};

	if (instruction !== undefined && pos >= instruction.start && pos < instruction.end) {
		let type = instructionTypeFromString(instruction.text);
		if (type) {
			let md = HoverDocForInstruction[type](text, instruction, size, operands, comment);
			if (md) {
				return { md, span: instruction };
			}
		}
	} else if (size !== undefined && pos >= size.start && pos < size.end) {

	} else if (operands !== undefined) {
		for (let operand of operands) {
			if (pos >= operand.start && pos < operand.end) {
				let parsed = stringifyOperand(operand.text);
				return {
					md: { kind: "markdown", value: `${parsed}` },
					span: operand
				}
			}
		}
	}

	return null;
}

function getDocumentSettings(resource: string): Thenable<Wave2LSPSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'wave2lsp'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});


connection.languages.diagnostics.on(async (params) => {
	const document = documents.get(params.textDocument.uri);
	if (document !== undefined) {
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: await validateTextDocument(document)
		} satisfies DocumentDiagnosticReport;
	} else {
		// We don't know the document. We can either try to read it from disk
		// or we don't report problems for it.
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: []
		} satisfies DocumentDiagnosticReport;
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(doc: TextDocument): Promise<Diagnostic[]> {
	const settings = await getDocumentSettings(doc.uri);

	return assemble(doc.getText())
		.slice(0, settings.maxNumberOfProblems)
		.map(d => ({
			severity: DiagnosticSeverity.Error,
			range: Range.create(doc.positionAt(d.start), doc.positionAt(d.end)),
			message: d.message,
			source: 'Wave2 Asm',
		}));
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.

		let context = AssemblySyntaxContext.Root as AssemblySyntaxContext;

		let lpos = _textDocumentPosition.position.line;
		let cpos = _textDocumentPosition.position.character;

		let doc = documents.get(_textDocumentPosition.textDocument.uri);
		let docText = doc?.getText();

		let codeRange: Range;
		let memRange: Range;

		let rxMem = /(?:\.(?:memory))[\w\W]*?(?:\.(?:code)|$)/g;
		let rxCode = /(?:\.(?:code))[\w\W]*?(?:\.(?:memory)|$)/g;

		if (doc && docText) {
			let memSegments = rxMem.exec(docText);
			let codeSegments = rxCode.exec(docText);

			if (memSegments && memSegments.length > 0) {
				memRange = Range.create(doc.positionAt(memSegments.index), doc.positionAt(memSegments.index + memSegments[0].length));

				if (memRange.start.line <= lpos && lpos <= memRange.end.line) {
					context = AssemblySyntaxContext.Memory;
				}
			}

			if (codeSegments && codeSegments.length > 0) {
				codeRange = Range.create(doc.positionAt(codeSegments.index), doc.positionAt(codeSegments.index + codeSegments[0].length));

				if (codeRange.start.line <= lpos && lpos <= codeRange.end.line) {
					context = AssemblySyntaxContext.Code;
				}
			}
		}

		let lineSoFar = doc?.getText(Range.create(lpos, 0, lpos, cpos));

		if (lineSoFar && context === AssemblySyntaxContext.Code) {
			let splitWhitespace = /(?:^|\s+)(\S+)/g.exec(lineSoFar);
			if (splitWhitespace) {
				let parts = splitWhitespace.splice(1);
				let instruction = null;
				let lastWord = "";
				if (parts.length == 1) {
					let parts = lineSoFar.split(".");
					if (parts.length == 2) {
						// We're in the size specifier
						context = AssemblySyntaxContext.InstructionSize;
					} else {
						// We're typing an instruction
						context = AssemblySyntaxContext.Instruction;
					}
				} else {
					context = contextForInstruction(parts);
				}
				// for (let i = 0; i < parts.length; i++) {
				// 	let word = parts[i];
				// 	switch (context) {
				// 		case AssemblySyntaxContext.Code:
				// 			if (lastWord !== "") {
				// 				let t = instructionTypeFromString(lastWord);
				// 				if (t !== null) {
				// 					instruction = t;
				// 				}
				// 			}
				// 			if (instruction !== null) {
				// 				let inst = instructionTypeStrings(instruction);
				// 				for (const i of inst) {
				// 					if (i.length > 0) {
				// 						return [
				// 							{ label: i, kind: CompletionItemKind.Function, data: 0 }
				// 						];
				// 					}
				// 				}
				// 			} else {
				// 				if (/\.$/.test(word)) {
				// 					context = AssemblySyntaxContext.InstructionSize;
				// 				} else {
				// 					context = AssemblySyntaxContext.Instruction;
				// 				}
				// 			}
				// 		default:

				// 	}
				// 	lastWord = word;
				// }
			}
		}

		let swizzles4 = [];
		for (let i = 119; i <= 122; i++) {
			for (let j = 119; j <= 122; j++) {
				for (let k = 119; k <= 122; k++) {
					for (let l = 119; l <= 122; l++) {
						swizzles4.push({ label: `${String.fromCharCode(i)}${String.fromCharCode(j)}${String.fromCharCode(k)}${String.fromCharCode(l)}`, kind: CompletionItemKind.Property, data: 0 });
					}
				}
			}
		}

		let insts: CompletionItem[] = [];
		// for (const [key, instruction] of Object.entries(instructions)) {
		// 	const inst = instructionTypeStrings(instruction.type);
		// 	for (const i of inst) {
		// 		if (i.length > 0) {
		// 			insts.push({ label: i, kind: CompletionItemKind.Function, data: 0 });
		// 		}
		// 	}
		// }

		for (const t of Object.entries(InstructionType)) {
			for (const s of instructionTypeStrings(t[1])) {
				switch (t[1]) {
					case InstructionType.Skip:
						insts.push({ label: s, kind: CompletionItemKind.Function, data: 0, labelDetails: { detail: ` ${t[1] + s.substring(s.length - 1)}` } });
						break;
					default:
						insts.push({ label: s, kind: CompletionItemKind.Function, data: 0, labelDetails: { detail: ` ${t[1]}` } });
				}
			}
		}

		switch (context) {
			case AssemblySyntaxContext.Memory: return [
				{ label: ".code", kind: CompletionItemKind.Keyword, data: 0, insertText: ".code", documentation: { kind: 'markdown', value: "### Code section declaration.\nSwitch the source file context into code mode.\n\nOnly one code section should be present in any one source file." } },
				{ label: "0040", kind: CompletionItemKind.Keyword, data: 0x40, detail: "Private Memory Region" },
				{ label: "0100", kind: CompletionItemKind.Keyword, data: 0x100, detail: "Banked Private Memory Region" },
				{ label: "0300", kind: CompletionItemKind.Keyword, data: 0x300, detail: "Module IO Region" },
				{ label: "1000", kind: CompletionItemKind.Keyword, data: 0x1000, detail: "Shared Memory Region" },
			];
			case AssemblySyntaxContext.Root: return [
				{ label: ".memory", kind: CompletionItemKind.Keyword, data: 0, insertText: ".memory", preselect: true, sortText: "0" },
				{ label: ".code", kind: CompletionItemKind.Keyword, data: 1, insertText: ".code", sortText: "1" },
			];
			case AssemblySyntaxContext.Register: return [
				{ label: "c0", kind: CompletionItemKind.Reference, data: 0 },
				{ label: "c1", kind: CompletionItemKind.Reference, data: 1 },
				{ label: "c2", kind: CompletionItemKind.Reference, data: 2 },
				{ label: "c3", kind: CompletionItemKind.Reference, data: 3 },
				{ label: "c4", kind: CompletionItemKind.Reference, data: 4 },
				{ label: "c5", kind: CompletionItemKind.Reference, data: 5 },
				{ label: "c6", kind: CompletionItemKind.Reference, data: 6 },
				{ label: "c7", kind: CompletionItemKind.Reference, data: 7 },
				{ label: "r0", kind: CompletionItemKind.Reference, data: 8 },
				{ label: "r1", kind: CompletionItemKind.Reference, data: 9 },
				{ label: "r2", kind: CompletionItemKind.Reference, data: 10 },
				{ label: "r3", kind: CompletionItemKind.Reference, data: 11 },
				{ label: "r4", kind: CompletionItemKind.Reference, data: 12 },
				{ label: "r5", kind: CompletionItemKind.Reference, data: 13 },
				{ label: "r6", kind: CompletionItemKind.Reference, data: 14 },
				{ label: "r7", kind: CompletionItemKind.Reference, data: 15 },
				{ label: "ri", kind: CompletionItemKind.Reference, data: 15 },
			];
			case AssemblySyntaxContext.RegisterSwizzle: return [
				{ label: "x", kind: CompletionItemKind.Property, data: 0 },
				{ label: "y", kind: CompletionItemKind.Property, data: 1 },
				{ label: "z", kind: CompletionItemKind.Property, data: 2 },
				{ label: "w", kind: CompletionItemKind.Property, data: 3 },
				...swizzles4
			];
			case AssemblySyntaxContext.InstructionSize: return [
				{ label: "b", kind: CompletionItemKind.Unit, data: 0, labelDetails: { detail: " Byte", description: "Byte Operation - SIMD Operation over 16-bit words."} },
				{ label: "w", kind: CompletionItemKind.Unit, data: 1, labelDetails: { detail: " Word", description: "Word Operation - SIMD Operation over 8-bit words."} },
				{ label: "h", kind: CompletionItemKind.Unit, data: 2, labelDetails: { detail: " High", description: "High Byte Operation - Operates on 8 bits of data from the first word."} },
				{ label: "l", kind: CompletionItemKind.Unit, data: 3, labelDetails: { detail: " Low", description: "Low Byte Operation - Operates on 8 bits of data from the first word."} },
			];
			case AssemblySyntaxContext.Immediate: return [];
			default: return [
				...insts,
			];
		}
	}
);

function contextForInstruction(parts: string[]): AssemblySyntaxContext {
	let inst = instructionTypeFromString(parts[0]);
	let size_part = inst?.split(".")[1] ?? null;
	switch (inst) {
		case InstructionType.Nop:
		case InstructionType.Halt:
		case InstructionType.Skip:
			return AssemblySyntaxContext.Code;

		case InstructionType.Sleep:
			if (parts.length == 1 && size_part !== null) return AssemblySyntaxContext.InstructionSize;
			if (parts.length == 2 && size_part !== null) return AssemblySyntaxContext.Register;
			return AssemblySyntaxContext.Immediate;

		case InstructionType.MoveWord:
		case InstructionType.SwapWord:
		case InstructionType.AddWord:
		case InstructionType.SubtractWord:
			break;

		case InstructionType.Move:
			break;

		case InstructionType.Swizzle:
			break;

		case InstructionType.Add:
		case InstructionType.AddSaturate:
		case InstructionType.Subtract:
		case InstructionType.SubtractSaturate:
		case InstructionType.Equal:
		case InstructionType.NotEqual:
		case InstructionType.Carry:
		case InstructionType.LessThan:
		case InstructionType.GreaterThan:
		case InstructionType.LessorEqual:
		case InstructionType.GreaterorEqual:
		case InstructionType.AddOver:
		case InstructionType.SubtractOver:
		case InstructionType.ReverseSubtractOver:
			if (parts.length == 1 && size_part !== null) return AssemblySyntaxContext.InstructionSize;
			break;

		case InstructionType.ShiftLeft:
		case InstructionType.ShiftRight:
		case InstructionType.ArithmeticShiftRight:
		case InstructionType.RotateLeft:
		case InstructionType.RotateRight:
			if (parts.length == 1 && size_part !== null) return AssemblySyntaxContext.InstructionSize;
			break;

		case InstructionType.BitwiseAnd:
		case InstructionType.BitwiseOr:
		case InstructionType.BitwiseXor:
		case InstructionType.BitwiseNand:
		case InstructionType.BitwiseNor:
		case InstructionType.BitwiseXnor:
		case InstructionType.BitwiseNotSrc:
		case InstructionType.BitwiseSrcAndNotDst:
		case InstructionType.BitwiseNotSrcAndDst:
		case InstructionType.BitwiseSrcOrNotDst:
		case InstructionType.BitwiseNotSrcOrDst:
		case InstructionType.BitwiseSwap:
			break;
		case InstructionType.BitwiseNotDst:
		case InstructionType.BitwiseAll:
		case InstructionType.BitwiseOne:
			break;

		case InstructionType.HorizontalAdd:
		case InstructionType.MultiplySaturate:
		case InstructionType.MultiplyLow:
		case InstructionType.MultiplyHigh:
		case InstructionType.Divide:
		case InstructionType.ReciprocalDivide:
			break;

		case InstructionType.Set:
			break;
		case InstructionType.Jump:
			break;
		case InstructionType.JumpEqual:
			break;
		case InstructionType.JumpNotEqual:
			break;
	}
	return AssemblySyntaxContext.Code;
}

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
