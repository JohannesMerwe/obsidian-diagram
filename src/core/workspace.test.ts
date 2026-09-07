import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot, parseManifest, projectOf } from './workspace';

const files = new Set(['obsidian/keel.json', 'pangolin/keel.json', 'obsidian/diagram-plugin/INDEX.md']);
const has = (p: string) => files.has(p);

describe('findWorkspaceRoot', () => {
	it('finds the nearest ancestor with keel.json', () => {
		expect(findWorkspaceRoot('obsidian/diagram-plugin/board/backlog/KD-1-x.md', has)).toBe('obsidian');
		expect(findWorkspaceRoot('obsidian/INDEX.md', has)).toBe('obsidian');
		expect(findWorkspaceRoot('pangolin/keel/INDEX.md', has)).toBe('pangolin');
	});
	it('returns null in plain mode', () => {
		expect(findWorkspaceRoot('notes/today.md', has)).toBeNull();
		expect(findWorkspaceRoot('today.md', has)).toBeNull();
	});
	it('accepts keel.json at the vault root', () => {
		expect(findWorkspaceRoot('a/b/c.md', (p) => p === 'keel.json')).toBe('');
	});
});

describe('parseManifest and projectOf', () => {
	const manifest = parseManifest(JSON.stringify({
		name: 'obsidian',
		type: 'code',
		projects: [
			{ name: 'diagram-plugin', repos: [{ url: 'git@github.com:JohannesMerwe/obsidian-diagram.git', id: 'x' }], board: null },
			{ name: 'board-plugin', repos: [] },
			{ repos: [] },
		],
	}));

	it('keeps only what the map needs', () => {
		expect(manifest).toEqual({
			name: 'obsidian',
			type: 'code',
			projects: [
				{ name: 'diagram-plugin', repos: [{ url: 'git@github.com:JohannesMerwe/obsidian-diagram.git' }] },
				{ name: 'board-plugin', repos: [] },
			],
		});
	});

	it('rejects malformed manifests', () => {
		expect(parseManifest('not json')).toBeNull();
		expect(parseManifest('[]')).toBeNull();
		expect(parseManifest('{}')).toEqual({ name: undefined, type: undefined, projects: [] });
	});

	it('maps a note to its project only when the manifest lists it', () => {
		if (!manifest) throw new Error('manifest');
		expect(projectOf('obsidian/diagram-plugin/board/backlog/KD-1.md', 'obsidian', manifest)).toBe('diagram-plugin');
		expect(projectOf('obsidian/reference/x.md', 'obsidian', manifest)).toBeNull();
		expect(projectOf('obsidian/INDEX.md', 'obsidian', manifest)).toBeNull();
		expect(projectOf('elsewhere/diagram-plugin/x.md', 'obsidian', manifest)).toBeNull();
		expect(projectOf('board-plugin/x.md', '', manifest)).toBe('board-plugin');
	});
});
