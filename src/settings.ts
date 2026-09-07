import { PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type { MapDirection } from './core/map';

export interface KeelDiagramSettings {
	/** Double-clicking a node in a rendered Mermaid diagram opens an inline label editor. */
	editOnDoubleClick: boolean;
	/** Flow direction of the generated workspace map. */
	mapDirection: MapDirection;
	/** Show a placeholder for d2 code blocks instead of leaving them as plain code. */
	d2Placeholder: boolean;
}

export const DEFAULT_SETTINGS: KeelDiagramSettings = {
	editOnDoubleClick: true,
	mapDirection: 'LR',
	d2Placeholder: true,
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
			{
				name: 'Placeholder for D2 blocks',
				desc: 'Show d2 code blocks in a placeholder box with a note. Turn off if another plugin renders D2. Takes effect after reopening the note.',
				control: { type: 'toggle', key: 'd2Placeholder', defaultValue: DEFAULT_SETTINGS.d2Placeholder },
			},
		];
	}
}
