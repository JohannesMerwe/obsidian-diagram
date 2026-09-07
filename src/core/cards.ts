/**
 * Board cards and the links between them (SPEC-integration §C3, §C4).
 * Reads both card shapes: frontmatter, and the pre-BOARD-1 bold header lines.
 * Pure TypeScript.
 */

/** §C4 id grammar. */
export const ID_GRAMMAR = /^[A-Z][A-Z0-9]{1,7}-\d+$/;
const ID_IN_TEXT = /\[([A-Z][A-Z0-9]{1,7}-\d+)\]/g;
const CARD_FILE = /^([A-Z][A-Z0-9]{1,7}-\d+)(?:-[^/]*)?\.md$/;

export interface Card {
	id: string;
	prefix: string;
	title: string;
	/** Vault path of the card file. */
	path: string;
	/** Ids this card links to, in order, without duplicates or self-links. */
	links: string[];
}

export function basename(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1);
}

/** Card id from a file name such as `KD-1-mermaid-round-trip.md`, or null. */
export function cardIdFromFileName(fileName: string): string | null {
	return CARD_FILE.exec(fileName)?.[1] ?? null;
}

/** True when the vault path looks like a card inside a board directory. */
export function isCardPath(path: string): boolean {
	return /(^|\/)board\//.test(path) && cardIdFromFileName(basename(path)) !== null;
}

export function prefixOf(id: string): string {
	return id.slice(0, id.indexOf('-'));
}

interface FrontMatter {
	fields: Map<string, string | string[]>;
	/** Number of lines the front matter block occupies, including both fences. */
	lines: number;
}

/** Minimal YAML: `key: value`, `key: [a, b]`, and block lists under a key. */
function parseFrontMatter(lines: string[]): FrontMatter | null {
	if ((lines[0] ?? '').trim() !== '---') return null;
	const fields = new Map<string, string | string[]>();
	let listKey: string | null = null;
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i] ?? '';
		if (line.trim() === '---') return { fields, lines: i + 1 };
		const item = /^\s+-\s*(.*)$/.exec(line);
		if (item && listKey) {
			const prev = fields.get(listKey);
			fields.set(listKey, [...(Array.isArray(prev) ? prev : []), unquote(item[1] ?? '')]);
			continue;
		}
		const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (!kv) continue;
		const key = kv[1] ?? '';
		const value = (kv[2] ?? '').trim();
		listKey = null;
		if (value === '') {
			fields.set(key, []);
			listKey = key;
		} else if (value.startsWith('[') && value.endsWith(']')) {
			const inner = value.slice(1, -1).trim();
			fields.set(key, inner === '' ? [] : inner.split(',').map((s) => unquote(s.trim())));
		} else {
			fields.set(key, unquote(value));
		}
	}
	return null;
}

function unquote(s: string): string {
	const m = /^(['"])(.*)\1$/.exec(s);
	return m ? (m[2] ?? '') : s;
}

/** Parses one card file. Null when the path is not a card. */
export function parseCard(path: string, content: string): Card | null {
	const id = cardIdFromFileName(basename(path));
	if (!id) return null;
	const lines = content.split('\n');
	const fm = parseFrontMatter(lines);
	const body = lines.slice(fm?.lines ?? 0);

	let title = '';
	const fmTitle = fm?.fields.get('title');
	if (typeof fmTitle === 'string') title = fmTitle;
	if (!title) {
		const heading = body.find((l) => /^#\s/.test(l));
		if (heading) title = heading.replace(/^#\s+/, '').replace(new RegExp(`^${id}\\s*[—–:-]\\s*`), '').trim();
	}
	if (!title) title = id;

	const links: string[] = [];
	const add = (raw: string) => {
		const link = raw.trim();
		if (ID_GRAMMAR.test(link) && link !== id && !links.includes(link)) links.push(link);
	};
	const fmLinks = fm?.fields.get('links');
	if (Array.isArray(fmLinks)) fmLinks.forEach(add);
	else if (typeof fmLinks === 'string') fmLinks.split(/[,\s]+/).forEach(add);

	let inFence = false;
	for (const line of body) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const bold = /^\*\*Links?:\*\*\s*(.*)$/i.exec(line.trim());
		if (bold) (bold[1] ?? '').split(/[,\s]+/).forEach(add);
		let m: RegExpExecArray | null;
		ID_IN_TEXT.lastIndex = 0;
		while ((m = ID_IN_TEXT.exec(line)) !== null) add(m[1] ?? '');
	}
	return { id, prefix: prefixOf(id), title, path, links };
}

/** Reads `prefix` from a `board.json` manifest, or null. */
export function boardPrefix(json: string): string | null {
	try {
		const value: unknown = JSON.parse(json);
		if (typeof value !== 'object' || value === null) return null;
		const prefix = (value as Record<string, unknown>).prefix;
		return typeof prefix === 'string' && /^[A-Z][A-Z0-9]{1,7}$/.test(prefix) ? prefix : null;
	} catch {
		return null;
	}
}
