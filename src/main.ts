import { MarkdownView, Notice, Plugin, type MarkdownPostProcessorContext, type MarkdownSectionInformation } from 'obsidian';
import { locateFence, replaceFenceBody, type Fence } from './core/fence';
import { locateNode, rewriteLabel, type LabelTarget, type RenderedRef } from './core/mermaid';
import { DEFAULT_SETTINGS, KeelDiagramSettingTab, type KeelDiagramSettings } from './settings';
import { openInlineEditor } from './ui/inline-editor';

export default class KeelDiagramPlugin extends Plugin {
	settings: KeelDiagramSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<KeelDiagramSettings> | null);
		this.addSettingTab(new KeelDiagramSettingTab(this.app, this));

		// Reading view and live preview both render fences through post processors, and
		// Mermaid draws its SVG into the section later. Remember each section's context and
		// listen once, on the document, so nothing is pinned when sections are re-rendered.
		this.registerMarkdownPostProcessor((el, ctx) => {
			if (!el.querySelector('pre, code, .mermaid')) return;
			this.sections.set(el, { ctx, rendered: ctx.getSectionInfo(el) });
		});
		this.registerDomEvent(document, 'dblclick', (evt: MouseEvent) => {
			void this.onDoubleClick(evt);
		});
	}

	/** Render context per section element that may hold a diagram. */
	private readonly sections = new WeakMap<HTMLElement, { ctx: MarkdownPostProcessorContext; rendered: MarkdownSectionInformation | null }>();

	private async onDoubleClick(evt: MouseEvent): Promise<void> {
		if (!this.settings.editOnDoubleClick) return;
		const target = evt.target instanceof Element ? evt.target : null;
		const svg = target?.closest('svg');
		if (!target || !svg) return;
		if (target.closest('.edgeLabel, .edgePath, .edgeLabels, .edgePaths')) return;

		let sectionEl: HTMLElement | null = null;
		for (let el = svg.parentElement; el; el = el.parentElement) {
			if (this.sections.has(el)) {
				sectionEl = el;
				break;
			}
		}
		if (!sectionEl) return;
		const section = this.sections.get(sectionEl);
		if (!section) return;
		const { ctx } = section;

		const info = ctx.getSectionInfo(sectionEl) ?? section.rendered;
		if (!info) return;
		const fence = locateFence(info.text, { lineStart: info.lineStart, lang: 'mermaid' });
		if (!fence) return;

		const node = locateNode(fence.body, renderedRef(target, svg));
		if (!node) return;

		evt.preventDefault();
		evt.stopPropagation();
		const anchor = target.closest('g.node, g') ?? target;
		const host = svg.parentElement ?? sectionEl;
		const path = ctx.sourcePath;
		const el = sectionEl;
		openInlineEditor(this, {
			host,
			anchor,
			value: node.label,
			onCommit: (value) => this.writeLabel(path, el, fence, node, value),
		});
	}

	/** Rewrites the label in the fence and writes the fence back to the note, through the editor when one shows it. */
	private async writeLabel(sourcePath: string, sectionEl: HTMLElement, fence: Fence, node: LabelTarget, value: string): Promise<void> {
		const hint = { lineStart: fence.startLine, body: fence.body, lang: 'mermaid' };
		const stale = () => new Notice('The diagram block changed since it was rendered; nothing was written.');

		const view = this.app.workspace
			.getLeavesOfType('markdown')
			.map((leaf) => leaf.view)
			.find((v): v is MarkdownView => v instanceof MarkdownView && v.containerEl.contains(sectionEl));

		if (view && view.getMode() === 'source' && view.file?.path === sourcePath) {
			const editor = view.editor;
			const current = locateFence(editor.getValue(), hint);
			if (!current) {
				stale();
				return;
			}
			const body = rewriteLabel(current.body, node, value);
			if (body === current.body) return;
			const lastLine = current.endLine - 1;
			editor.replaceRange(body, { line: current.startLine + 1, ch: 0 }, { line: lastLine, ch: editor.getLine(lastLine).length });
			return;
		}

		const file = this.app.vault.getFileByPath(sourcePath);
		if (!file) return;
		let found = true;
		await this.app.vault.process(file, (data) => {
			const current = locateFence(data, hint);
			found = current !== null;
			if (!current) return data;
			const body = rewriteLabel(current.body, node, value);
			return body === current.body ? data : replaceFenceBody(data, current, body);
		});
		if (!found) stale();
	}
}

/** Collects the attributes Mermaid leaves on the rendered element that identify its node. */
function renderedRef(target: Element, svg: Element): RenderedRef {
	let id: string | null = null;
	let name: string | null = null;
	for (let el: Element | null = target; el && el !== svg; el = el.parentElement) {
		if (id === null && el.id && /^(flowchart-|classId-|actor\d+$)/.test(el.id)) id = el.id;
		if (name === null) name = el.getAttribute('name') ?? el.querySelector(':scope > [name]')?.getAttribute('name') ?? null;
	}
	return { id, name, text: target.textContent };
}
