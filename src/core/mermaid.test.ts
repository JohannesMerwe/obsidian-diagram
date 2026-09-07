import { describe, expect, it } from 'vitest';
import { detectKind, locateNode, readLabel, rewriteLabel } from './mermaid';

describe('detectKind', () => {
	it('recognises the three supported headers', () => {
		expect(detectKind('graph TD\n  A --> B')).toBe('flowchart');
		expect(detectKind('flowchart LR\n  A --> B')).toBe('flowchart');
		expect(detectKind('sequenceDiagram\n  A->>B: hi')).toBe('sequence');
		expect(detectKind('classDiagram\n  class A')).toBe('class');
		expect(detectKind('classDiagram-v2\n  class A')).toBe('class');
	});
	it('skips comments, directives and front matter', () => {
		expect(detectKind('%% a comment\n%%{init: {"theme":"dark"}}%%\nflowchart TD\n  A')).toBe('flowchart');
		expect(detectKind('---\ntitle: Hello\n---\nsequenceDiagram\n  A->>B: hi')).toBe('sequence');
	});
	it('returns null for unsupported diagrams', () => {
		expect(detectKind('gantt\n  title x')).toBeNull();
		expect(detectKind('')).toBeNull();
	});
});

describe('flowchart', () => {
	const src = [
		'flowchart TD',
		'    A[Start] --> B{Decide?}',
		'    B -->|yes| C([Ship it])',
		'    B -->|no| D[["Fix #quot;bugs#quot;"]]',
		'    C --> E',
		'    E -.-> A',
		'    %% A[not this]',
		'    style A fill:#f9f',
	].join('\n');

	it('locates nodes from rendered ids', () => {
		expect(locateNode(src, { id: 'flowchart-A-0' })).toEqual({ kind: 'flowchart', key: 'A', label: 'Start' });
		expect(locateNode(src, { id: 'flowchart-B-1' })).toEqual({ kind: 'flowchart', key: 'B', label: 'Decide?' });
		expect(locateNode(src, { id: 'flowchart-C-2' })).toEqual({ kind: 'flowchart', key: 'C', label: 'Ship it' });
		expect(locateNode(src, { id: 'flowchart-D-3' })).toEqual({ kind: 'flowchart', key: 'D', label: 'Fix "bugs"' });
		expect(locateNode(src, { id: 'flowchart-E-4' })).toEqual({ kind: 'flowchart', key: 'E', label: 'E' });
	});

	it('ignores nodes that are not in the source and non-node elements', () => {
		expect(locateNode(src, { id: 'flowchart-Z-9' })).toBeNull();
		expect(locateNode(src, { id: 'L_A_B_0' })).toBeNull();
		expect(locateNode(src, {})).toBeNull();
	});

	it('falls back to the rendered text when it is unique', () => {
		expect(locateNode(src, { text: 'Ship it' })?.key).toBe('C');
		expect(locateNode(src, { text: 'nowhere' })).toBeNull();
	});

	it('rewrites a plain label in place', () => {
		const out = rewriteLabel(src, { kind: 'flowchart', key: 'A' }, 'Begin');
		expect(out).toBe(src.replace('A[Start]', 'A[Begin]'));
	});

	it('rewrites a diamond and a stadium', () => {
		expect(rewriteLabel(src, { kind: 'flowchart', key: 'B' }, 'Go?')).toContain('B{Go?}');
		expect(rewriteLabel(src, { kind: 'flowchart', key: 'C' }, 'Release')).toContain('C([Release])');
	});

	it('keeps quotes and encodes them when the label needs it', () => {
		expect(rewriteLabel(src, { kind: 'flowchart', key: 'D' }, 'Say "hi"')).toContain('D[["Say #quot;hi#quot;"]]');
		expect(rewriteLabel(src, { kind: 'flowchart', key: 'A' }, 'a (b)')).toContain('A["a (b)"]');
		expect(rewriteLabel(src, { kind: 'flowchart', key: 'A' }, 'x | y')).toContain('A["x | y"]');
	});

	it('adds a label to a node that only has an id', () => {
		const out = rewriteLabel(src, { kind: 'flowchart', key: 'E' }, 'End');
		expect(out).toContain('    C --> E[End]');
		expect(out).toContain('    E -.-> A');
		expect(out.split('\n').length).toBe(src.split('\n').length);
	});

	it('does not touch comments, style lines or edge labels', () => {
		const out = rewriteLabel(src, { kind: 'flowchart', key: 'A' }, 'X');
		expect(out).toContain('%% A[not this]');
		expect(out).toContain('style A fill:#f9f');
		expect(out).toContain('-->|yes|');
	});

	it('rewrites every labelled occurrence of the node', () => {
		const multi = 'graph LR\n  A[One] --> B\n  A[One] --> C\n  B --> A';
		const out = rewriteLabel(multi, { kind: 'flowchart', key: 'A' }, 'Uno');
		expect(out).toBe('graph LR\n  A[Uno] --> B\n  A[Uno] --> C\n  B --> A');
	});

	it('handles ids that are prefixes of other ids and ids with digits', () => {
		const s = 'graph TD\n  A1[First] --> A10[Tenth]\n  A[Bare]';
		expect(rewriteLabel(s, { kind: 'flowchart', key: 'A1' }, 'F')).toBe('graph TD\n  A1[F] --> A10[Tenth]\n  A[Bare]');
		expect(rewriteLabel(s, { kind: 'flowchart', key: 'A' }, 'Z')).toBe('graph TD\n  A1[First] --> A10[Tenth]\n  A[Z]');
	});

	it('handles the remaining shapes', () => {
		const s = [
			'graph TD',
			'  a((circle))',
			'  b>flag]',
			'  c{{hex}}',
			'  d[/para/]',
			'  e[\\para2\\]',
			'  f[/trap\\]',
			'  g[(db)]',
			'  h(((dbl)))',
			'  i(round)',
		].join('\n');
		const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
		const labels = ['circle', 'flag', 'hex', 'para', 'para2', 'trap', 'db', 'dbl', 'round'];
		keys.forEach((k, i) => expect(readLabel(s, { kind: 'flowchart', key: k })).toBe(labels[i]));
		expect(rewriteLabel(s, { kind: 'flowchart', key: 'f' }, 'tz')).toContain('f[/tz\\]');
		expect(rewriteLabel(s, { kind: 'flowchart', key: 'h' }, 'x')).toContain('h(((x)))');
		expect(rewriteLabel(s, { kind: 'flowchart', key: 'b' }, 'y')).toContain('b>y]');
	});

	it('supports the v11 attribute form', () => {
		const s = 'flowchart LR\n  A@{ shape: cyl, label: "Store" } --> B@{ shape: rect, label: plain }';
		expect(readLabel(s, { kind: 'flowchart', key: 'A' })).toBe('Store');
		expect(readLabel(s, { kind: 'flowchart', key: 'B' })).toBe('plain');
		expect(rewriteLabel(s, { kind: 'flowchart', key: 'A' }, 'Disk')).toContain('A@{ shape: cyl, label: "Disk" }');
		expect(rewriteLabel(s, { kind: 'flowchart', key: 'B' }, 'Two words')).toContain('B@{ shape: rect, label: "Two words" }');
	});

	it('does not confuse subgraph ids with nodes', () => {
		const s = 'flowchart TB\n  subgraph one[Group]\n    A[Item]\n  end';
		expect(readLabel(s, { kind: 'flowchart', key: 'one' })).toBeNull();
		expect(rewriteLabel(s, { kind: 'flowchart', key: 'A' }, 'Thing')).toContain('A[Thing]');
	});

	it('returns the source unchanged when the label is the same', () => {
		expect(rewriteLabel(src, { kind: 'flowchart', key: 'A' }, 'Start')).toBe(src);
	});
});

describe('sequence', () => {
	const src = [
		'sequenceDiagram',
		'    participant A as Alice',
		'    actor B',
		'    A->>B: Hello',
		'    B-->>A: Hi',
		'    C->>+A: New here',
		'    A-->>-C: Welcome',
	].join('\n');

	it('locates actors by name attribute', () => {
		expect(locateNode(src, { name: 'A' })).toEqual({ kind: 'sequence', key: 'A', label: 'Alice' });
		expect(locateNode(src, { name: 'B' })).toEqual({ kind: 'sequence', key: 'B', label: 'B' });
		expect(locateNode(src, { name: 'C' })).toEqual({ kind: 'sequence', key: 'C', label: 'C' });
		expect(locateNode(src, { name: 'Nobody' })).toBeNull();
	});

	it('locates actors by positional line id', () => {
		expect(locateNode(src, { id: 'actor0' })?.key).toBe('A');
		expect(locateNode(src, { id: 'actor1' })?.key).toBe('B');
		expect(locateNode(src, { id: 'actor2' })?.key).toBe('C');
		expect(locateNode(src, { id: 'actor7' })).toBeNull();
	});

	it('rewrites an alias', () => {
		expect(rewriteLabel(src, { kind: 'sequence', key: 'A' }, 'Alicia')).toContain('    participant A as Alicia');
	});

	it('adds an alias to a declared actor without one', () => {
		const out = rewriteLabel(src, { kind: 'sequence', key: 'B' }, 'Bob');
		expect(out).toContain('    actor B as Bob');
		expect(out).not.toContain('actor B\n');
	});

	it('declares an implicit actor at its first appearance, keeping order', () => {
		const out = rewriteLabel(src, { kind: 'sequence', key: 'C' }, 'Carol');
		const lines = out.split('\n');
		expect(lines[5]).toBe('    participant C as Carol');
		expect(lines[6]).toBe('    C->>+A: New here');
	});

	it('declares the source too when both actors first appear as a message target', () => {
		const s = 'sequenceDiagram\n  X->>Y: ping';
		const out = rewriteLabel(s, { kind: 'sequence', key: 'Y' }, 'Why');
		expect(out).toBe('sequenceDiagram\n  participant X\n  participant Y as Why\n  X->>Y: ping');
	});

	it('handles multi-word ids and the create keyword', () => {
		const s = 'sequenceDiagram\n  participant Web app as Browser\n  create participant D as Dee\n  Web app->>D: go';
		expect(readLabel(s, { kind: 'sequence', key: 'Web app' })).toBe('Browser');
		expect(rewriteLabel(s, { kind: 'sequence', key: 'D' }, 'Dora')).toContain('  create participant D as Dora');
	});

	it('does not alter messages', () => {
		const out = rewriteLabel(src, { kind: 'sequence', key: 'A' }, 'Alicia');
		expect(out).toContain('A->>B: Hello');
		expect(out).toContain('A-->>-C: Welcome');
	});
});

describe('class', () => {
	const src = [
		'classDiagram',
		'    class Animal["Living thing"] {',
		'        +int age',
		'    }',
		'    class Dog',
		'    Animal <|-- Dog',
		'    Dog : +bark()',
		'    Cat --> Animal',
	].join('\n');

	it('locates classes from rendered ids', () => {
		expect(locateNode(src, { id: 'classId-Animal-0' })).toEqual({ kind: 'class', key: 'Animal', label: 'Living thing' });
		expect(locateNode(src, { id: 'classId-Dog-1' })).toEqual({ kind: 'class', key: 'Dog', label: 'Dog' });
		expect(locateNode(src, { id: 'classId-Cat-2' })).toEqual({ kind: 'class', key: 'Cat', label: 'Cat' });
		expect(locateNode(src, { id: 'classId-Fish-3' })).toBeNull();
	});

	it('rewrites an existing label', () => {
		expect(rewriteLabel(src, { kind: 'class', key: 'Animal' }, 'Creature')).toContain('class Animal["Creature"] {');
	});

	it('adds a label to a declared class', () => {
		expect(rewriteLabel(src, { kind: 'class', key: 'Dog' }, 'Good boy')).toContain('    class Dog["Good boy"]\n');
	});

	it('inserts a declaration for a class only used in relations', () => {
		const out = rewriteLabel(src, { kind: 'class', key: 'Cat' }, 'Feline');
		expect(out.split('\n')[1]).toBe('    class Cat["Feline"]');
		expect(out).toContain('Cat --> Animal');
	});

	it('encodes quotes', () => {
		expect(rewriteLabel(src, { kind: 'class', key: 'Animal' }, 'A "thing"')).toContain('class Animal["A #quot;thing#quot;"]');
	});

	it('handles relation-side labels', () => {
		const s = 'classDiagram\n  A["Alpha"] <|-- B["Beta"]';
		expect(readLabel(s, { kind: 'class', key: 'B' })).toBe('Beta');
		expect(rewriteLabel(s, { kind: 'class', key: 'B' }, 'Bee')).toBe('classDiagram\n  A["Alpha"] <|-- B["Bee"]');
	});
});
