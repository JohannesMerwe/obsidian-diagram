/**
 * Fenced code blocks in a markdown note: find them, and replace the body of one
 * without touching anything else in the note (SPEC-integration §C6).
 * Pure TypeScript, no `obsidian` import.
 */

export interface Fence {
	/** First word of the info string, lowercased. Empty for a plain fence. */
	lang: string;
	/** Line index of the opening fence. */
	startLine: number;
	/** Line index of the closing fence, or the line count when the fence is unterminated. */
	endLine: number;
	/** Lines between the fences, joined with `\n`, indentation untouched. */
	body: string;
}

const OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;

/** Every fenced block in the text, top-level or indented. */
export function findFences(text: string): Fence[] {
	const lines = text.split('\n');
	const out: Fence[] = [];
	let i = 0;
	while (i < lines.length) {
		const m = OPEN.exec(lines[i] ?? '');
		if (!m) {
			i++;
			continue;
		}
		const marker = m[2] ?? '';
		const info = (m[3] ?? '').trim();
		// A backtick fence's info string may not contain backticks.
		if (marker.startsWith('`') && info.includes('`')) {
			i++;
			continue;
		}
		const close = new RegExp(`^\\s*${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`);
		let j = i + 1;
		while (j < lines.length && !close.test(lines[j] ?? '')) j++;
		out.push({
			lang: (info.split(/\s+/)[0] ?? '').toLowerCase(),
			startLine: i,
			endLine: j,
			body: lines.slice(i + 1, j).join('\n'),
		});
		i = j + 1;
	}
	return out;
}

/** Returns the text with the fence body replaced. The fence must come from `findFences(text)`. */
export function replaceFenceBody(text: string, fence: Fence, body: string): string {
	const lines = text.split('\n');
	const bodyLines = body === '' ? [] : body.split('\n');
	lines.splice(fence.startLine + 1, fence.endLine - fence.startLine - 1, ...bodyLines);
	return lines.join('\n');
}

export interface FenceHint {
	/** Line of the opening fence when the note was rendered (Obsidian section info). */
	lineStart?: number;
	/** Body the note had when rendered, used to verify or to search. */
	body?: string;
	/** Language the fence must have. */
	lang?: string;
}

/**
 * Finds the fence a rendered block came from, in the note's *current* text.
 * Trusts the rendered line number when the fence there still has the same
 * body; otherwise looks for a unique fence with that body. Null if neither works.
 */
export function locateFence(text: string, hint: FenceHint): Fence | null {
	const fences = findFences(text).filter((f) => hint.lang === undefined || f.lang === hint.lang);
	if (hint.lineStart !== undefined) {
		const at = fences.find((f) => f.startLine === hint.lineStart);
		if (at && (hint.body === undefined || at.body === hint.body)) return at;
	}
	if (hint.body !== undefined) {
		const same = fences.filter((f) => f.body === hint.body);
		if (same.length === 1) return same[0] ?? null;
	}
	return null;
}
