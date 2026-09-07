import { Notice, Plugin } from 'obsidian';

export default class KeelDiagramPlugin extends Plugin {
	onload(): void {
		this.addCommand({
			id: 'status',
			name: 'Show status',
			callback: () => {
				new Notice('Keel Diagram ' + this.manifest.version + ' is loaded. Nothing to show yet.');
			},
		});
	}
}
