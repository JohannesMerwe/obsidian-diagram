/**
 * Placeholder for ```d2 fences until D2 rendering ships (card KD-3).
 * Shows the source untouched, plus one muted line saying why it is not drawn.
 */
export function renderD2Placeholder(source: string, el: HTMLElement): void {
	const box = el.createDiv({ cls: 'keel-diagram-d2-placeholder' });
	box.createDiv({ cls: 'keel-diagram-d2-placeholder-note', text: 'D2 diagram (not rendered: Keel Diagram does not bundle the D2 renderer yet)' });
	box.createEl('pre').createEl('code', { text: source });
}
