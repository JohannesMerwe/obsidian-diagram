import { PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type { MapDirection } from './core/map';

export interface KeelDiagramSettings {
	/** Double-clicking a node in a rendered Mermaid diagram opens an inline label editor. */
	editOnDoubleClick: boolean;
	/** Flow direction of the generated workspace map. */
	mapDirection: MapDirection;
}

export const DEFAULT_SETTINGS: KeelDiagramSettings = {
	editOnDoubleClick: true,
	mapDirection: 'LR',
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
			{
				name: 'Workspace map direction',
				desc: 'Layout of the generated workspace map: left to right, or top down.',
				control: {
					type: 'dropdown',
					key: 'mapDirection',
					defaultValue: DEFAULT_SETTINGS.mapDirection,
					options: { LR: 'Left to right', TD: 'Top down' },
				},
			},
		];
	}
}
