import { PluginSettingTab, type SettingDefinitionItem } from 'obsidian';

export interface KeelDiagramSettings {
	/** Double-clicking a node in a rendered Mermaid diagram opens an inline label editor. */
	editOnDoubleClick: boolean;
}

export const DEFAULT_SETTINGS: KeelDiagramSettings = {
	editOnDoubleClick: true,
};

/** Declarative settings tab (Obsidian 1.13). Values live in `plugin.settings`. */
export class KeelDiagramSettingTab extends PluginSettingTab {
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Edit labels on double-click',
				desc: 'Double-click a node in a rendered Mermaid diagram to rename it. The change is written back into the code block.',
				control: { type: 'toggle', key: 'editOnDoubleClick', defaultValue: DEFAULT_SETTINGS.editOnDoubleClick },
			},
		];
	}
}
