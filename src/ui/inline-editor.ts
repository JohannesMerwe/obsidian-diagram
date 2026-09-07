import type { Plugin } from 'obsidian';

export interface InlineEditorOptions {
	/** Element the input is positioned inside; gets `position: relative` while editing. */
	host: HTMLElement;
	/** Rendered node the input is placed over. */
	anchor: Element;
	value: string;
	onCommit: (value: string) => void | Promise<void>;
}

/**
 * A single-line editor laid over a rendered node. Enter commits, Escape cancels,
 * losing focus commits. Only one editor is open per host at a time.
 */
export function openInlineEditor(plugin: Plugin, opts: InlineEditorOptions): void {
	const { host, anchor } = opts;
	host.querySelector('.keel-diagram-inline-editor')?.remove();
	host.classList.add('keel-diagram-editing');

	const hostRect = host.getBoundingClientRect();
	const rect = anchor.getBoundingClientRect();
	const input = host.createEl('input', { cls: 'keel-diagram-inline-editor', type: 'text', value: opts.value });
	input.setCssProps({
		'--keel-diagram-editor-top': `${rect.top - hostRect.top + host.scrollTop}px`,
		'--keel-diagram-editor-left': `${rect.left - hostRect.left + host.scrollLeft}px`,
		'--keel-diagram-editor-width': `${Math.max(rect.width, 120)}px`,
		'--keel-diagram-editor-height': `${Math.max(rect.height, 24)}px`,
	});

	let done = false;
	const close = () => {
		if (done) return;
		done = true;
		input.remove();
		host.classList.remove('keel-diagram-editing');
	};
	const commit = () => {
		if (done) return;
		const value = input.value.trim();
		close();
		if (value !== '' && value !== opts.value) void opts.onCommit(value);
	};

	plugin.registerDomEvent(input, 'keydown', (evt: KeyboardEvent) => {
		if (evt.key === 'Enter') {
			evt.preventDefault();
			evt.stopPropagation();
			commit();
		} else if (evt.key === 'Escape') {
			evt.preventDefault();
			evt.stopPropagation();
			close();
		}
	});
	plugin.registerDomEvent(input, 'blur', commit);
	plugin.registerDomEvent(input, 'mousedown', (evt: MouseEvent) => evt.stopPropagation());
	plugin.registerDomEvent(input, 'dblclick', (evt: MouseEvent) => evt.stopPropagation());

	input.focus();
	input.select();
}
