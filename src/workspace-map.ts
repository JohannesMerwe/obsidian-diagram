import type { App, TFile } from 'obsidian';
import { boardPrefix, isCardPath, parseCard, type Card } from './core/cards';
import { buildWorkspaceMap, type MapDirection } from './core/map';
import { dirname, findWorkspaceRoot, joinPath, parseManifest, projectOf } from './core/workspace';

/** Vault-side collection for the workspace map (§C1, §C6). Never touches checkouts or binding.json. */
export class WorkspaceMapper {
	constructor(private readonly app: App) {}

	/** Nearest ancestor directory of the note holding `keel.json`, or null in plain mode. Synchronous. */
	rootOf(notePath: string): string | null {
		return findWorkspaceRoot(notePath, (p) => this.app.vault.getFileByPath(p) !== null);
	}

	/** Builds the map body for the workspace the note belongs to. Null when the manifest is unreadable. */
	async build(notePath: string, direction: MapDirection): Promise<string | null> {
		const root = this.rootOf(notePath);
		if (root === null) return null;
		const manifestFile = this.app.vault.getFileByPath(joinPath(root, 'keel.json'));
		if (!manifestFile) return null;
		const manifest = parseManifest(await this.app.vault.read(manifestFile));
		if (!manifest) return null;

		const under = (path: string) => root === '' || path.startsWith(root + '/');
		const cards: { card: Card; project: string | null }[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!under(file.path) || !isCardPath(file.path)) continue;
			const card = parseCard(file.path, await this.app.vault.cachedRead(file));
			if (card) cards.push({ card, project: projectOf(file.path, root, manifest) });
		}

		const prefixProjects: Record<string, string> = {};
		const manifests = this.app.vault.getFiles().filter((f: TFile) => f.name === 'board.json' && under(f.path) && dirname(dirname(f.path)) !== '');
		for (const file of manifests) {
			const prefix = boardPrefix(await this.app.vault.read(file));
			const project = projectOf(file.path, root, manifest);
			if (prefix && project) prefixProjects[prefix] = project;
		}

		return buildWorkspaceMap({ manifest, cards, prefixProjects, direction });
	}
}
