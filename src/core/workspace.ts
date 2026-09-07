/**
 * Workspace and project detection (SPEC-integration §C1).
 * Pure TypeScript; the shell supplies `hasFile`.
 */

export interface KeelRepo {
	url?: string;
	defaultBranch?: string;
}

export interface KeelProject {
	name: string;
	repos?: KeelRepo[];
}

export interface KeelManifest {
	name?: string;
	type?: string;
	projects?: KeelProject[];
}

/** Parent directory of a vault path, '' for the vault root. */
export function dirname(path: string): string {
	const i = path.lastIndexOf('/');
	return i < 0 ? '' : path.slice(0, i);
}

export function joinPath(dir: string, name: string): string {
	return dir === '' ? name : `${dir}/${name}`;
}

/**
 * Nearest ancestor directory of `notePath` that contains `keel.json`, or null (plain mode).
 * The vault root is '' and is checked last.
 */
export function findWorkspaceRoot(notePath: string, hasFile: (path: string) => boolean): string | null {
	let dir = dirname(notePath);
	for (;;) {
		if (hasFile(joinPath(dir, 'keel.json'))) return dir;
		if (dir === '') return null;
		dir = dirname(dir);
	}
}

/** First path segment below the root when the manifest lists a project of that name, else null. */
export function projectOf(path: string, root: string, manifest: KeelManifest): string | null {
	const rel = root === '' ? path : path.startsWith(root + '/') ? path.slice(root.length + 1) : null;
	if (rel === null) return null;
	const first = rel.split('/')[0] ?? '';
	return manifest.projects?.some((p) => p.name === first) ? first : null;
}

/** Parses `keel.json`; null when it is not the object this plugin understands. */
export function parseManifest(json: string): KeelManifest | null {
	try {
		const value: unknown = JSON.parse(json);
		if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
		const obj = value as Record<string, unknown>;
		const projects = Array.isArray(obj.projects)
			? obj.projects
					.filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null && typeof (p as Record<string, unknown>).name === 'string')
					.map((p) => ({
						name: p.name as string,
						repos: Array.isArray(p.repos)
							? p.repos
									.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
									.map((r) => ({ url: typeof r.url === 'string' ? r.url : undefined }))
							: [],
					}))
			: [];
		return { name: typeof obj.name === 'string' ? obj.name : undefined, type: typeof obj.type === 'string' ? obj.type : undefined, projects };
	} catch {
		return null;
	}
}
