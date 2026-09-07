/**
 * Mermaid label round-trip (SPEC-integration §C6, card KD-1).
 *
 * Given the source of a fenced ```mermaid block and a reference to an element in
 * the SVG that Mermaid rendered from it, find which node the element belongs to,
 * read its label from the source, and rewrite that label without touching
 * anything else in the block.
 *
 * Rendered-element contract, verified against Mermaid 11.13.0 as bundled in
 * Obsidian 1.13.7:
 *   flowchart  g.node#flowchart-<nodeId>-<n>
 *   class      g.node#classId-<className>-<n>
 *   sequence   rect.actor[name=<actorId>] and line#actor<n>[name=<actorId>]
 *
 * No `obsidian` import here; this file is pure TypeScript.
 */

export type DiagramKind = 'flowchart' | 'sequence' | 'class';

/** What the shell extracts from the clicked SVG element. All fields optional. */
export interface RenderedRef {
	/** `id` attribute of the nearest ancestor that has one. */
	id?: string | null;
	/** `name` attribute of the nearest ancestor that has one (sequence actors). */
	name?: string | null;
	/** Visible text of the clicked element, used as a last resort. */
	text?: string | null;
}

/** A node in the source whose label can be edited. */
export interface LabelTarget {
	kind: DiagramKind;
	/** Node id, actor id or class name as written in the source. */
	key: string;
	/** Current label, entity codes decoded. Equals `key` when the source has no label. */
	label: string;
}

// ---------------------------------------------------------------------------
// Shared helpers

const DIRECTIVE = /^\s*%%\{[\s\S]*?\}%%\s*$/;

/** Returns the diagram body lines, with an `active` flag that is false for comments, directives and front matter. */
function splitLines(source: string): { text: string; active: boolean }[] {
	const raw = source.split('\n');
	const lines: { text: string; active: boolean }[] = [];
	let inFrontMatter = false;
	let seenContent = false;
	for (let i = 0; i < raw.length; i++) {
		const text = raw[i] ?? '';
		const trimmed = text.trim();
		if (!seenContent && trimmed === '---' && !inFrontMatter) {
			inFrontMatter = true;
			lines.push({ text, active: false });
			continue;
		}
		if (inFrontMatter) {
			if (trimmed === '---') inFrontMatter = false;
			lines.push({ text, active: false });
			continue;
		}
		if (trimmed !== '') seenContent = true;
		const active = trimmed !== '' && !trimmed.startsWith('%%') && !DIRECTIVE.test(text);
		lines.push({ text, active });
	}
	return lines;
}

function firstActiveLine(lines: { text: string; active: boolean }[]): number {
	return lines.findIndex((l) => l.active);
}

/** Detects the diagram kind from the header keyword; null for anything this plugin does not edit. */
export function detectKind(source: string): DiagramKind | null {
	const lines = splitLines(source);
	const idx = firstActiveLine(lines);
	if (idx < 0) return null;
	const head = (lines[idx]?.text ?? '').trim();
	if (/^(graph|flowchart)\b/.test(head)) return 'flowchart';
	if (/^sequenceDiagram\b/.test(head)) return 'sequence';
	if (/^classDiagram(-v2)?\b/.test(head)) return 'class';
	return null;
}

/** Decodes the Mermaid entity codes that labels commonly carry. */
export function decodeEntities(label: string): string {
	return label
		.replace(/#quot;/g, '"')
		.replace(/#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)));
}

function encodeQuotes(label: string): string {
	return label.replace(/"/g, '#quot;');
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Flowchart

const FLOW_KEYWORDS = /^\s*(graph|flowchart|subgraph|end|style|classDef|class|click|linkStyle|direction)\b/;
const FLOW_ID = 'A-Za-z0-9_';

/** Shape openers, longest first, with their closers. */
const FLOW_SHAPES: [string, string[]][] = [
	['(((', [')))']],
	['([', ['])']],
	['[[', [']]']],
	['[(', [')]']],
	['((', ['))']],
	['{{', ['}}']],
	['[/', ['/]', '\\]']],
	['[\\', ['\\]', '/]']],
	['[', [']']],
	['(', [')']],
	['{', ['}']],
	['>', [']']],
];

interface FlowOccurrence {
	line: number;
	/** Offset of the label text inside the line (inside quotes when quoted). */
	labelStart: number;
	labelEnd: number;
	quoted: boolean;
	/** True for the v11 `id@{ label: "..." }` form. */
	attr: boolean;
	label: string;
}

/** Every labelled occurrence of node `id` in a flowchart source. */
function flowOccurrences(lines: { text: string; active: boolean }[], id: string): FlowOccurrence[] {
	const out: FlowOccurrence[] = [];
	const idRe = new RegExp(`(^|[^${FLOW_ID}])(${escapeRegExp(id)})(?=[^${FLOW_ID}]|$)`, 'g');
	lines.forEach((line, lineNo) => {
		if (!line.active || FLOW_KEYWORDS.test(line.text)) return;
		const text = line.text;
		let m: RegExpExecArray | null;
		while ((m = idRe.exec(text)) !== null) {
			const after = m.index + m[0].length;
			// v11 attribute form: id@{ ... label: "..." ... }
			if (text.startsWith('@{', after)) {
				const close = text.indexOf('}', after);
				if (close < 0) continue;
				const inner = text.slice(after + 2, close);
				const lm = /label\s*:\s*("([^"]*)"|'([^']*)'|([^,}]*))/.exec(inner);
				if (!lm) continue;
				const valueStart = after + 2 + lm.index + lm[0].length - (lm[1] ?? '').length;
				if (lm[2] !== undefined || lm[3] !== undefined) {
					const val = lm[2] ?? lm[3] ?? '';
					out.push({ line: lineNo, labelStart: valueStart + 1, labelEnd: valueStart + 1 + val.length, quoted: true, attr: true, label: val });
				} else {
					const val = (lm[4] ?? '').trim();
					const s = text.indexOf(val, valueStart);
					out.push({ line: lineNo, labelStart: s, labelEnd: s + val.length, quoted: false, attr: true, label: val });
				}
				continue;
			}
			for (const [open, closers] of FLOW_SHAPES) {
				if (!text.startsWith(open, after)) continue;
				const bodyStart = after + open.length;
				if (text[bodyStart] === '"') {
					const q = text.indexOf('"', bodyStart + 1);
					if (q < 0) break;
					const closer = closers.find((c) => text.startsWith(c, q + 1));
					if (!closer) break;
					out.push({ line: lineNo, labelStart: bodyStart + 1, labelEnd: q, quoted: true, attr: false, label: text.slice(bodyStart + 1, q) });
				} else {
					let end = -1;
					for (const c of closers) {
						const p = text.indexOf(c, bodyStart);
						if (p >= 0 && (end < 0 || p < end)) end = p;
					}
					if (end < 0) break;
					const label = text.slice(bodyStart, end);
					if (label.includes('"')) break;
					out.push({ line: lineNo, labelStart: bodyStart, labelEnd: end, quoted: false, attr: false, label });
				}
				break;
			}
		}
	});
	return out;
}

/** First bare reference to node `id` (no shape after it), for adding a label to a label-less node. */
function flowBareOccurrence(lines: { text: string; active: boolean }[], id: string): { line: number; end: number } | null {
	const idRe = new RegExp(`(^|[^${FLOW_ID}])(${escapeRegExp(id)})(?=[^${FLOW_ID}]|$)`, 'g');
	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		const line = lines[lineNo];
		if (!line || !line.active || FLOW_KEYWORDS.test(line.text)) continue;
		const text = line.text;
		let m: RegExpExecArray | null;
		while ((m = idRe.exec(text)) !== null) {
			const end = m.index + m[0].length;
			const before = text.slice(0, m.index + (m[1] ?? '').length);
			const quotes = (before.match(/"/g) ?? []).length;
			const pipes = (before.match(/\|/g) ?? []).length;
			if (quotes % 2 === 1 || pipes % 2 === 1) continue;
			const next = text[end];
			if (next === '@' || FLOW_SHAPES.some(([o]) => text.startsWith(o, end))) continue;
			return { line: lineNo, end };
		}
	}
	return null;
}

const FLOW_UNQUOTED_SAFE = /^[^"[\]{}()|<>#;&\\]+$/;

function flowNodeLabel(source: string, id: string): string | null {
	const occ = flowOccurrences(splitLines(source), id);
	if (occ.length > 0) return decodeEntities(occ[occ.length - 1]?.label ?? id);
	if (flowBareOccurrence(splitLines(source), id)) return id;
	return null;
}

function flowRewrite(source: string, id: string, newLabel: string): string {
	const lines = splitLines(source);
	const occ = flowOccurrences(lines, id);
	const raw = source.split('\n');
	if (occ.length === 0) {
		const bare = flowBareOccurrence(lines, id);
		if (!bare) return source;
		const text = raw[bare.line] ?? '';
		const shaped = FLOW_UNQUOTED_SAFE.test(newLabel) ? `[${newLabel}]` : `["${encodeQuotes(newLabel)}"]`;
		raw[bare.line] = text.slice(0, bare.end) + shaped + text.slice(bare.end);
		return raw.join('\n');
	}
	// Rewrite from the end of each line so earlier offsets stay valid.
	const byLine = new Map<number, FlowOccurrence[]>();
	for (const o of occ) byLine.set(o.line, [...(byLine.get(o.line) ?? []), o]);
	for (const [lineNo, list] of byLine) {
		let text = raw[lineNo] ?? '';
		for (const o of list.sort((a, b) => b.labelStart - a.labelStart)) {
			let replacement: string;
			const start = o.labelStart;
			const end = o.labelEnd;
			if (o.attr) {
				replacement = o.quoted ? encodeQuotes(newLabel) : `"${encodeQuotes(newLabel)}"`;
			} else if (o.quoted) {
				replacement = encodeQuotes(newLabel);
			} else if (FLOW_UNQUOTED_SAFE.test(newLabel)) {
				replacement = newLabel;
			} else {
				replacement = `"${encodeQuotes(newLabel)}"`;
			}
			text = text.slice(0, start) + replacement + text.slice(end);
		}
		raw[lineNo] = text;
	}
	return raw.join('\n');
}

// ---------------------------------------------------------------------------
// Sequence

const SEQ_ARROW = '(?:<<-->>|<<->>|-->>|->>|--x|-x|--\\)|-\\)|-->|->)';
const SEQ_MSG = new RegExp(`^\\s*([^+\\->:;\\n,]+?)\\s*${SEQ_ARROW}\\s*[+-]?\\s*([^+\\->:;\\n,]+?)\\s*:`);

interface SeqActor {
	id: string;
	label: string;
	/** Line of the `participant`/`actor` declaration, or -1. */
	declLine: number;
	/** Line where the actor first appears. */
	firstLine: number;
	/** True if the first appearance is as the target of a message whose source also first appears there. */
	firstAsTargetWithNewSource: string | null;
}

function parseSeqDecl(text: string): { id: string; alias: string | null; prefixEnd: number } | null {
	const m = /^(\s*)((?:create\s+)?(?:participant|actor)\s+)(.*)$/.exec(text);
	if (!m) return null;
	const rest = m[3] ?? '';
	const asIdx = rest.search(/\sas\s/);
	const prefixEnd = (m[1] ?? '').length + (m[2] ?? '').length;
	if (asIdx >= 0) {
		return { id: rest.slice(0, asIdx).trim(), alias: rest.slice(asIdx + 4).trim(), prefixEnd };
	}
	return { id: rest.trim(), alias: null, prefixEnd };
}

function seqActors(lines: { text: string; active: boolean }[]): SeqActor[] {
	const actors: SeqActor[] = [];
	const find = (id: string): SeqActor | undefined => actors.find((a) => a.id === id);
	const add = (id: string, line: number, extra?: Partial<SeqActor>): SeqActor => {
		const found = find(id);
		if (found) return found;
		const actor: SeqActor = { id, label: id, declLine: -1, firstLine: line, firstAsTargetWithNewSource: null, ...extra };
		actors.push(actor);
		return actor;
	};
	lines.forEach((line, lineNo) => {
		if (!line.active) return;
		const decl = parseSeqDecl(line.text);
		if (decl) {
			const a = add(decl.id, lineNo);
			if (a.declLine < 0) {
				a.declLine = lineNo;
				a.label = decl.alias ?? decl.id;
			}
			return;
		}
		const msg = SEQ_MSG.exec(line.text);
		if (msg) {
			const from = (msg[1] ?? '').trim();
			const to = (msg[2] ?? '').trim();
			const fromNew = !find(from);
			add(from, lineNo);
			if (!find(to)) add(to, lineNo, { firstAsTargetWithNewSource: fromNew ? from : null });
		}
	});
	return actors;
}

function seqRewrite(source: string, id: string, newLabel: string): string {
	const lines = splitLines(source);
	const actors = seqActors(lines);
	const actor = actors.find((a) => a.id === id);
	if (!actor) return source;
	const raw = source.split('\n');
	const alias = newLabel.replace(/[\r\n]+/g, ' ').replace(/;/g, '#59;').trim();
	if (actor.declLine >= 0) {
		const text = raw[actor.declLine] ?? '';
		const decl = parseSeqDecl(text);
		if (!decl) return source;
		const head = text.slice(0, decl.prefixEnd);
		raw[actor.declLine] = `${head}${decl.id} as ${alias}`;
		return raw.join('\n');
	}
	const indent = /^\s*/.exec(raw[actor.firstLine] ?? '')?.[0] ?? '';
	const inserted: string[] = [];
	if (actor.firstAsTargetWithNewSource) inserted.push(`${indent}participant ${actor.firstAsTargetWithNewSource}`);
	inserted.push(`${indent}participant ${actor.id} as ${alias}`);
	raw.splice(actor.firstLine, 0, ...inserted);
	return raw.join('\n');
}

// ---------------------------------------------------------------------------
// Class

const CLASS_NAME = 'A-Za-z0-9_';

interface ClassOccurrence {
	line: number;
	labelStart: number;
	labelEnd: number;
	label: string;
}

function classOccurrences(lines: { text: string; active: boolean }[], name: string): ClassOccurrence[] {
	const out: ClassOccurrence[] = [];
	const re = new RegExp(`(^|[^${CLASS_NAME}])(${escapeRegExp(name)})(?:~[^~]*~)?\\["([^"]*)"\\]`, 'g');
	lines.forEach((line, lineNo) => {
		if (!line.active) return;
		let m: RegExpExecArray | null;
		while ((m = re.exec(line.text)) !== null) {
			const label = m[3] ?? '';
			const labelEnd = m.index + m[0].length - 2;
			out.push({ line: lineNo, labelStart: labelEnd - label.length, labelEnd, label });
		}
	});
	return out;
}

function classDeclLine(lines: { text: string; active: boolean }[], name: string): { line: number; end: number } | null {
	const re = new RegExp(`^(\\s*class\\s+${escapeRegExp(name)}(?:~[^~]*~)?)(?=[^${CLASS_NAME}\\[]|$)`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line || !line.active) continue;
		const m = re.exec(line.text);
		if (m) return { line: i, end: (m[1] ?? '').length };
	}
	return null;
}

function classMentioned(lines: { text: string; active: boolean }[], name: string): boolean {
	const re = new RegExp(`(^|[^${CLASS_NAME}])${escapeRegExp(name)}(?=[^${CLASS_NAME}]|$)`);
	return lines.some((l) => l.active && re.test(l.text));
}

function classLabel(source: string, name: string): string | null {
	const lines = splitLines(source);
	const occ = classOccurrences(lines, name);
	if (occ.length > 0) return decodeEntities(occ[occ.length - 1]?.label ?? name);
	return classMentioned(lines, name) ? name : null;
}

function classRewrite(source: string, name: string, newLabel: string): string {
	const lines = splitLines(source);
	const raw = source.split('\n');
	const occ = classOccurrences(lines, name);
	const encoded = encodeQuotes(newLabel.replace(/[\r\n]+/g, ' '));
	if (occ.length > 0) {
		const byLine = new Map<number, ClassOccurrence[]>();
		for (const o of occ) byLine.set(o.line, [...(byLine.get(o.line) ?? []), o]);
		for (const [lineNo, list] of byLine) {
			let text = raw[lineNo] ?? '';
			for (const o of list.sort((a, b) => b.labelStart - a.labelStart)) {
				text = text.slice(0, o.labelStart) + encoded + text.slice(o.labelEnd);
			}
			raw[lineNo] = text;
		}
		return raw.join('\n');
	}
	const decl = classDeclLine(lines, name);
	if (decl) {
		const text = raw[decl.line] ?? '';
		raw[decl.line] = `${text.slice(0, decl.end)}["${encoded}"]${text.slice(decl.end)}`;
		return raw.join('\n');
	}
	if (!classMentioned(lines, name)) return source;
	const head = firstActiveLine(lines);
	const indent = /^\s*/.exec(raw[head + 1] ?? '')?.[0] ?? '    ';
	raw.splice(head + 1, 0, `${indent}class ${name}["${encoded}"]`);
	return raw.join('\n');
}

// ---------------------------------------------------------------------------
// Public API

/** Reads the current label of a target from the source. Null when the node is not in the source. */
export function readLabel(source: string, target: Pick<LabelTarget, 'kind' | 'key'>): string | null {
	switch (target.kind) {
		case 'flowchart':
			return flowNodeLabel(source, target.key);
		case 'sequence': {
			const actor = seqActors(splitLines(source)).find((a) => a.id === target.key);
			return actor ? decodeEntities(actor.label) : null;
		}
		case 'class':
			return classLabel(source, target.key);
	}
}

/**
 * Resolves a rendered element to the node it was drawn from.
 * Returns null when the diagram kind is unsupported or the element is not a node.
 */
export function locateNode(source: string, ref: RenderedRef): LabelTarget | null {
	const kind = detectKind(source);
	if (!kind) return null;
	const id = ref.id ?? '';
	let key: string | null = null;
	if (kind === 'flowchart') {
		const m = /^flowchart-(.+)-\d+$/.exec(id);
		if (m) key = m[1] ?? null;
	} else if (kind === 'class') {
		const m = /^classId-(.+)-\d+$/.exec(id);
		if (m) key = m[1] ?? null;
	} else {
		if (ref.name) key = ref.name;
		else {
			const m = /^actor(\d+)$/.exec(id);
			if (m) key = seqActors(splitLines(source))[Number(m[1])]?.id ?? null;
		}
	}
	if (key === null && ref.text) {
		key = keyByText(source, kind, ref.text.trim());
	}
	if (key === null) return null;
	const label = readLabel(source, { kind, key });
	if (label === null) return null;
	return { kind, key, label };
}

/** Last resort: a unique node whose label (or id) equals the rendered text. */
function keyByText(source: string, kind: DiagramKind, text: string): string | null {
	const lines = splitLines(source);
	const candidates = new Set<string>();
	if (kind === 'sequence') {
		for (const a of seqActors(lines)) if (decodeEntities(a.label) === text) candidates.add(a.id);
	} else if (kind === 'flowchart') {
		const idRe = new RegExp(`(^|[^${FLOW_ID}])([${FLOW_ID}]+)(?=[\\[({>@])`, 'g');
		for (const l of lines) {
			if (!l.active || FLOW_KEYWORDS.test(l.text)) continue;
			let m: RegExpExecArray | null;
			while ((m = idRe.exec(l.text)) !== null) {
				const id = m[2] ?? '';
				if (flowNodeLabel(source, id) === text) candidates.add(id);
			}
		}
	} else {
		const re = new RegExp(`(^|[^${CLASS_NAME}])class\\s+([${CLASS_NAME}]+)`, 'g');
		for (const l of lines) {
			if (!l.active) continue;
			let m: RegExpExecArray | null;
			while ((m = re.exec(l.text)) !== null) {
				const id = m[2] ?? '';
				if (classLabel(source, id) === text) candidates.add(id);
			}
		}
	}
	return candidates.size === 1 ? [...candidates][0] ?? null : null;
}

/**
 * Rewrites the label of `target` to `newLabel` and returns the new source.
 * Returns the source unchanged when nothing matched or the label is unchanged.
 */
export function rewriteLabel(source: string, target: Pick<LabelTarget, 'kind' | 'key'>, newLabel: string): string {
	const current = readLabel(source, target);
	if (current === null || current === newLabel) return source;
	switch (target.kind) {
		case 'flowchart':
			return flowRewrite(source, target.key, newLabel);
		case 'sequence':
			return seqRewrite(source, target.key, newLabel);
		case 'class':
			return classRewrite(source, target.key, newLabel);
	}
}
