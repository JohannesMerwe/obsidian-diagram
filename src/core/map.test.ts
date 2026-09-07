import { describe, expect, it } from 'vitest';
import type { Card } from './cards';
import { MAP_MARKER, buildWorkspaceMap, findMapFences, regenerateMaps, repoShortName, wrapMapFence } from './map';
import type { KeelManifest } from './workspace';

const manifest: KeelManifest = {
	name: 'obsidian',
	projects: [
		{ name: 'board-plugin', repos: [{ url: 'git@github.com:JohannesMerwe/obsidian-board.git' }] },
		{ name: 'diagram-plugin', repos: [{ url: 'https://github.com/JohannesMerwe/obsidian-diagram.git' }] },
		{ name: 'empty-project', repos: [] },
	],
};

const card = (id: string, title: string, links: string[] = []): Card => ({ id, prefix: id.slice(0, id.indexOf('-')), title, path: `${id}.md`, links });

describe('repoShortName', () => {
	it('shortens ssh and https urls', () => {
		expect(repoShortName('git@github.com:JohannesMerwe/obsidian-board.git')).toBe('JohannesMerwe/obsidian-board');
		expect(repoShortName('https://github.com/JohannesMerwe/obsidian-diagram.git')).toBe('JohannesMerwe/obsidian-diagram');
		expect(repoShortName('https://gitlab.com/group/repo')).toBe('group/repo');
		expect(repoShortName('weird')).toBe('weird');
	});
});

describe('buildWorkspaceMap', () => {
	it('starts with the marker and draws projects, repos and links', () => {
		const body = buildWorkspaceMap({
			manifest,
			cards: [
				{ card: card('KD-4', 'Workspace map', ['KB-3', 'KK-2']), project: 'diagram-plugin' },
				{ card: card('KB-3', 'Add card'), project: 'board-plugin' },
				{ card: card('KD-1', 'Not linked'), project: 'diagram-plugin' },
			],
			prefixProjects: { KK: 'keys-plugin' },
		});
		const lines = body.split('\n');
		expect(lines[0]).toBe(MAP_MARKER);
		expect(lines[1]).toBe('flowchart LR');
		expect(body).toContain('    ws["obsidian"]');
		expect(body).toContain('    subgraph p_board_plugin["board-plugin"]');
		expect(body).toContain('        r_0_board_plugin["JohannesMerwe/obsidian-board"]');
		expect(body).toContain('        c_KB_3["KB-3 Add card"]');
		expect(body).toContain('        c_KD_4["KD-4 Workspace map"]');
		expect(body).not.toContain('KD-1');
		// KK-2 has no card and its project is not in the manifest: workspace level, id only
		expect(body).toContain('    c_KK_2["KK-2"]');
		expect(body).toContain('    subgraph p_empty_project["empty-project"]\n    end');
		expect(body).toContain('    ws --> p_board_plugin');
		expect(body).toContain('    c_KD_4 --> c_KB_3');
		expect(body).toContain('    c_KD_4 --> c_KK_2');
	});

	it('honours the direction and escapes quotes', () => {
		const body = buildWorkspaceMap({
			manifest: { name: 'say "hi"', projects: [] },
			cards: [],
			direction: 'TD',
		});
		expect(body).toContain('flowchart TD');
		expect(body).toContain('ws["say #quot;hi#quot;"]');
	});

	it('never mentions checkout paths', () => {
		const body = buildWorkspaceMap({ manifest, cards: [] });
		expect(body).not.toMatch(/\.code|binding\.json|\/Users\//);
	});
});

describe('regenerateMaps', () => {
	const stale = wrapMapFence(`${MAP_MARKER}\nflowchart LR\n    ws["old"]`);
	const note = `# Map\n\n${stale}\n\nText\n\n\`\`\`mermaid\ngraph TD\n  A\n\`\`\`\n`;

	it('finds only marked blocks', () => {
		expect(findMapFences(note)).toHaveLength(1);
		expect(findMapFences('```mermaid\ngraph TD\n  A\n```')).toHaveLength(0);
	});

	it('replaces every marked block and leaves the rest alone', () => {
		const fresh = `${MAP_MARKER}\nflowchart LR\n    ws["new"]`;
		const { text, count } = regenerateMaps(note + '\n' + stale, fresh);
		expect(count).toBe(2);
		expect(text).not.toContain('ws["old"]');
		expect(text.split('ws["new"]')).toHaveLength(3);
		expect(text).toContain('graph TD\n  A');
	});

	it('reports zero when there is nothing to regenerate', () => {
		expect(regenerateMaps('plain', 'x')).toEqual({ text: 'plain', count: 0 });
	});
});
