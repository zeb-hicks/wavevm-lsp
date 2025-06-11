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
	VersionedTextDocumentIdentifier} from 'vscode-languageserver/node';

// import {
// 	MarkdownString
// } from "vscode";

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { AssemblySyntaxContext, InstructionPart, InstructionType, instructionTypeFromString, instructionTypeStrings, stringifyOperand } from './parsing';
import { chop, HoverDocForInstruction, ParserForInstruction, Span } from './validation';
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

interface RequiredSegment {
	part: InstructionPart;
	errorMessage: string;
	optional: boolean;
}

type RangeWithText = {
	text: string;
	range: Range;
}

type ExtractedRanges = {
	memory: RangeWithText[],
	code: RangeWithText[]
}

type LabelDefinition = {
	label: string;
	address: number;
	line: number;
}

function extractRanges(doc: TextDocument): ExtractedRanges {
	const diagnostics: Diagnostic[] = [];

	const text = doc.getText();

	let memRanges: RangeWithText[] = [];
	let codeRanges: RangeWithText[] = [];

	let rxMem = /(?:\.memory)(?<mem>[\w\W]*?)(?:\.code|$)/gd;
	let rxCode = /(?:\.code)(?<code>[\w\W]*?)(?:\.memory|$)/gd;

	let match: RegExpExecArray | null;

	while (match = rxMem.exec(text)) {
		if (match.indices?.groups?.mem) {
			let start = match.indices?.groups?.mem[0];
			let end = match.indices?.groups?.mem[1];
			let range = Range.create(doc.positionAt(start), doc.positionAt(end));
			let text = doc.getText(range);
			memRanges.push({ text, range });
		}
	}

	while (match = rxCode.exec(text)) {
		if (match.indices?.groups?.code) {
			let start = match.indices?.groups?.code[0];
			let end = match.indices?.groups?.code[1];
			let range = Range.create(doc.positionAt(start), doc.positionAt(end));
			let text = doc.getText(range);
			codeRanges.push({ text, range });
		}
	}

	return {
		memory: memRanges,
		code: codeRanges
	}
}

async function validateTextDocument(doc: TextDocument): Promise<Diagnostic[]> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(doc.uri);

	const diagnostics: Diagnostic[] = [];

	let { memory, code } = extractRanges(doc);

	// console.log("Ranges: ", memory, code);

	let memory_words = [];

	for (const mem of memory) {
		for (let i = 0, j = 0; i < mem.text.length; i++) {
			let c = mem.text.charAt(i);
			if (c === ";") {
				while (i < mem.text.length && mem.text.charAt(i) !== "\n") i++;
				continue;
			}
			let n = Number.parseInt(c, 16);
			if (n >= 0 && n <= 15) {
				if (j == 0) {
					memory_words.push({ value: n, range: Range.create(mem.range.start, mem.range.end) });
					j++;
				} else {
					memory_words[memory_words.length - 1].value <<= 4;
					memory_words[memory_words.length - 1].value |= n;
					j++;
					if (j > 3){
						j = 0;
					}
				}
			}
		}
	}

	let code_line_parser = /^\s*(?<inst>[^\n\;]+)\s*(?!\;.*|$)?/md;
	let code_lines = [];

	for (const segment of code) {
		let l = segment.range.start.line;
		let c = segment.range.start.character;
		for (const line of segment.text.split("\n")) {
			let match = code_line_parser.exec(line);
			if (match) {
				let range = Range.create(Position.create(l, c), Position.create(l, c + line.length));
				code_lines.push({ line: match.groups?.inst || "", range });
			}
			l++;
			c = 0;
		}
	}

	// console.log("Memory Words: ", memory_words);
	// console.log(code[0].text);
	// console.log("Code Lines: ", code_lines);

	let labels: { [key: string]: LabelDefinition } = {};
	let addr = 0x40;

	for (let i = 0; i < code_lines.length; i++) {
		let line = code_lines[i].line;
		let code = line.trim();
		if (code.length === 0) continue; // Skip empty lines

		let range = code_lines[i].range;

		let splitWhitespace = /(?:^|\s+)(\S+)/g.exec(line) || [];
		let instruction = instructionTypeFromString(splitWhitespace[0] || "");

		if (instruction == null) {
			switch (code[0]) {
				case "!":
					// Raw hex instruction
					let hex = code.substring(1).replace(/\s/g, "");
					let num = Number.parseInt(hex, 16);
					if (isNaN(num)) {
						diagnostics.push({
							severity: DiagnosticSeverity.Error,
							range: range,
							message: `Raw hex instructions must be valid hex numbers but found: ${code}`,
							source: "Wave2 Asm",
						});
					} else if (num < 0 || num > 0xffff) {
						diagnostics.push({
							severity: DiagnosticSeverity.Error,
							range: range,
							message: `Raw hex instructions must be between 0x0000 and 0xFFFF.`,
							source: "Wave2 Asm",
						});
					}
					break;
				case ":":
					// Label
					let label = code.substring(1).replace(/\s/g, "");
					if (labels[label] !== undefined) {
						// Label redefinition
						diagnostics.push({
							severity: DiagnosticSeverity.Error,
							range: range,
							message: `Label "${label}" is already defined at ${labels[label].line+1}`,
							source: "Wave2 Asm",
						});
					} else {
						labels[label] = {
							label: label,
							address: addr,
							line: range.start.line
						};
					}
					break;
				default:
					// Invalid instruction
					diagnostics.push({
						severity: DiagnosticSeverity.Error,
						range: range,
						message: `Instruction "${splitWhitespace[0]}" is not a valid instruction.`,
						source: "Wave2 Asm",
					});
					continue;
			}
		} else {
			let parser = ParserForInstruction[instruction];
			let result = parser(code);
			if (result !== null) {
				let start = range.start.character + result.range.start.character;
				let end = range.start.character + result.range.end.character;
				range.start.character = start;
				range.end.character = end;

				diagnostics.push({
					severity: result.severity,
					range: range,
					message: result.message,
					source: result.source,
				});
			}
		}

		// console.log(`${range.start.line+1}@${addr}: ${instruction}`);

		addr++;
	}

	// while ((m = rxLine.exec(text))) {
	// 	let line = m[0];
	// 	let range = Range.create(doc.positionAt(m.index), doc.positionAt(m.index + line.length - 1));
	// 	range.end.character += 1;

	// 	// if (!(range.start.line > codeRanges[0].start.line && range.end.line <= codeRanges[0].end.line)) continue;

	// 	let code = m.groups?.inst.trim();
	// 	if (code) {
	// 		let splitWhitespace = /(?:^|\s+)(\S+)/g.exec(code) || [];
	// 		let instruction: InstructionType | null = instructionTypeFromString(splitWhitespace[0] || "");
	// 		if (instruction == null) {
	// 			if (code[0] === "!") {
	// 				// Raw hex value
	// 				let hex = code.substring(1).replace(/\s/g, "");
	// 				if (hex.length !== 4) {
	// 					diagnostics.push({
	// 						severity: DiagnosticSeverity.Error,
	// 						range: range,
	// 						message: `Raw hex values must be exactly one word (16bit) but found: ${code}`,
	// 						source: "Wave2 Asm",
	// 					});
	// 				}
	// 				let validHex = /^[0-9A-Fa-f]{4}$/.test(hex);
	// 				let parsedHex = parseInt(hex, 16);
	// 				if (isNaN(parsedHex) || !validHex) {
	// 					diagnostics.push({
	// 						severity: DiagnosticSeverity.Error,
	// 						range: range,
	// 						message: `Raw hex values must be valid hex numbers but found: ${code}`,
	// 						source: "Wave2 Asm",
	// 					});
	// 				} else {
	// 					diagnostics.push({
	// 						severity: DiagnosticSeverity.Hint,
	// 						range: range,
	// 						message: `Hex value: ${hex} (${parsedHex})`,
	// 						source: "Wave2 Asm",
	// 					});
	// 				}
	// 				continue;
	// 			}
	// 			if (code[0] === ":") {
	// 				// Label
	// 				let label = code.substring(1).replace(/\s/g, "");
	// 				if (label.length === 0) {
	// 					diagnostics.push({
	// 						severity: DiagnosticSeverity.Error,
	// 						range: range,
	// 						message: `Labels must be valid identifiers but found: ${code}`,
	// 						source: "Wave2 Asm",
	// 					});
	// 				} else {
	// 					diagnostics.push({
	// 						severity: DiagnosticSeverity.Hint,
	// 						range: range,
	// 						message: `Label: ${label}`,
	// 						source: "Wave2 Asm",
	// 					});
	// 				}
	// 				continue;
	// 			}
	// 			diagnostics.push({
	// 				severity: DiagnosticSeverity.Error,
	// 				range: range,
	// 				message: `Instruction "${splitWhitespace[0]}" is not a valid instruction.`,
	// 				source: "Wave2 Asm",
	// 			});
	// 			continue;
	// 		} else {
	// 			let parser = ParserForInstruction[instruction];
	// 			let result = parser(code);
	// 			if (result !== null) {
	// 				let start = range.start.character + result.range.start.character;
	// 				let end = range.start.character + result.range.end.character;
	// 				range.start.character = start;
	// 				range.end.character = end;

	// 				diagnostics.push({
	// 					severity: result.severity,
	// 					range: range,
	// 					message: result.message,
	// 					source: result.source,
	// 				});
	// 			}
	// 		}
	// 	}
	// }
	return diagnostics;
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
