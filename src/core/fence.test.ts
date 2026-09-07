import { describe, expect, it } from 'vitest';
import { findFences, locateFence, replaceFenceBody } from './fence';

const note = [
	'# Title',
	'',
	'```mermaid',
	'graph TD',
	'  A[One] --> B',
	'```',
	'',
	'Some text with `inline` code.',
	'',
	'~~~~js',
	'const x = "```";',
	'~~~~',
	'',
	'  ```mermaid',
	'  sequenceDiagram',
	'  A->>B: hi',
	'  ```',
].join('\n');

describe('findFences', () => {
	it('finds backtick and tilde fences with their language and body', () => {
		const fences = findFences(note);
		expect(fences.map((f) => [f.lang, f.startLine, f.endLine])).toEqual([
			['mermaid', 2, 5],
			['js', 9, 11],
			['mermaid', 13, 16],
		]);
		expect(fences[0]?.body).toBe('graph TD\n  A[One] --> B');
		expect(fences[1]?.body).toBe('const x = "```";');
		expect(fences[2]?.body).toBe('  sequenceDiagram\n  A->>B: hi');
	});

	it('treats an unterminated fence as running to the end', () => {
		const fences = findFences('```mermaid\ngraph TD\n  A');
		expect(fences).toHaveLength(1);
		expect(fences[0]?.endLine).toBe(3);
		expect(fences[0]?.body).toBe('graph TD\n  A');
	});

	it('requires the closing fence to be at least as long', () => {
		const fences = findFences('````md\n```\ncode\n```\n````');
		expect(fences).toHaveLength(1);
		expect(fences[0]?.body).toBe('```\ncode\n```');
	});
});

describe('replaceFenceBody', () => {
	it('replaces only the body', () => {
		const fence = findFences(note)[0];
		if (!fence) throw new Error('no fence');
		const out = replaceFenceBody(note, fence, 'graph TD\n  A[Uno] --> B');
		expect(out).toBe(note.replace('A[One]', 'A[Uno]'));
	});

	it('handles a body with a different number of lines', () => {
		const fence = findFences(note)[0];
		if (!fence) throw new Error('no fence');
		const out = replaceFenceBody(note, fence, 'graph TD\n  A[Uno] --> B\n  B --> C');
		expect(findFences(out)[0]?.body).toBe('graph TD\n  A[Uno] --> B\n  B --> C');
		expect(findFences(out)[2]?.startLine).toBe(14);
	});
});

describe('locateFence', () => {
	it('trusts the rendered line when the body still matches', () => {
		const f = locateFence(note, { lineStart: 2, body: 'graph TD\n  A[One] --> B', lang: 'mermaid' });
		expect(f?.startLine).toBe(2);
	});

	it('falls back to a unique body match when lines shifted', () => {
		const shifted = 'intro\n\n' + note;
		const f = locateFence(shifted, { lineStart: 2, body: 'graph TD\n  A[One] --> B', lang: 'mermaid' });
		expect(f?.startLine).toBe(4);
	});

	it('returns null when the body is ambiguous or gone', () => {
		const dup = note + '\n```mermaid\ngraph TD\n  A[One] --> B\n```';
		expect(locateFence(dup, { lineStart: 99, body: 'graph TD\n  A[One] --> B' })).toBeNull();
		expect(locateFence(note, { lineStart: 2, body: 'nope' })).toBeNull();
		expect(locateFence(note, { lineStart: 9, body: 'const x = "```";', lang: 'mermaid' })).toBeNull();
	});
});
