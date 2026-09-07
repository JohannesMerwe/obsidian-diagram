import { describe, expect, it } from 'vitest';
import { boardPrefix, cardIdFromFileName, isCardPath, parseCard } from './cards';

describe('card files', () => {
	it('extracts ids from file names', () => {
		expect(cardIdFromFileName('KD-1-mermaid-label-round-trip-in-src-core.md')).toBe('KD-1');
		expect(cardIdFromFileName('KD-12.md')).toBe('KD-12');
		expect(cardIdFromFileName('BOARD.md')).toBeNull();
		expect(cardIdFromFileName('kd-1-lower.md')).toBeNull();
	});
	it('recognises card paths inside board directories', () => {
		expect(isCardPath('obsidian/diagram-plugin/board/backlog/KD-1-x.md')).toBe(true);
		expect(isCardPath('obsidian/diagram-plugin/board/done/2026/KD-1-x.md')).toBe(true);
		expect(isCardPath('obsidian/diagram-plugin/board/BOARD.md')).toBe(false);
		expect(isCardPath('obsidian/diagram-plugin/KD-1-x.md')).toBe(false);
	});
});

describe('parseCard', () => {
	it('reads frontmatter title and links, plus [ID] references in the body', () => {
		const content = [
			'---',
			'id: KD-4',
			'title: Workspace map from keel.json',
			'state: todo',
			'links: [KB-3, KQ-1]',
			'---',
			'',
			'# KD-4 — Workspace map from keel.json',
			'',
			'Waits on [KK-2] and mentions [KD-4] itself and [KB-3] again.',
			'',
			'```',
			'[KC-9] inside code is ignored',
			'```',
		].join('\n');
		const card = parseCard('obsidian/diagram-plugin/board/backlog/KD-4-workspace-map-from-keel-json.md', content);
		expect(card).toEqual({
			id: 'KD-4',
			prefix: 'KD',
			title: 'Workspace map from keel.json',
			path: 'obsidian/diagram-plugin/board/backlog/KD-4-workspace-map-from-keel-json.md',
			links: ['KB-3', 'KQ-1', 'KK-2'],
		});
	});

	it('reads a block list of links', () => {
		const content = '---\ntitle: "Quoted"\nlinks:\n  - KB-1\n  - KB-2\n---\n# KD-2 — x';
		const card = parseCard('x/board/wip/KD-2-y.md', content);
		expect(card?.title).toBe('Quoted');
		expect(card?.links).toEqual(['KB-1', 'KB-2']);
	});

	it('falls back to the heading and the bold header shape', () => {
		const content = '# KD-3 — D2 rendering\n\n**Status:** todo\n**Links:** KD-1, KQ-2\n';
		const card = parseCard('x/board/backlog/KD-3-d2.md', content);
		expect(card?.title).toBe('D2 rendering');
		expect(card?.links).toEqual(['KD-1', 'KQ-2']);
	});

	it('uses the id as title when nothing else is there', () => {
		expect(parseCard('x/board/backlog/KD-9.md', 'nothing here')?.title).toBe('KD-9');
		expect(parseCard('x/board/backlog/notes.md', '')).toBeNull();
	});
});

describe('boardPrefix', () => {
	it('reads the prefix from board.json', () => {
		expect(boardPrefix('{"id":"diagram-plugin","prefix":"KD","next":6}')).toBe('KD');
		expect(boardPrefix('{"prefix":"bad prefix"}')).toBeNull();
		expect(boardPrefix('nope')).toBeNull();
	});
});
