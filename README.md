# Keel Diagram

Edit Mermaid and D2 diagrams in place; the text block is the source of truth.

**Obsidian plugin** · id `keel-diagram` · status: scaffold (2026-09-07), no features yet · MIT

Agents write diagrams as text. People want to click and rename. This plugin renders
`mermaid` and `d2` fences and lets you edit a node's label in the rendered view, writing
the change back into the fenced block so the agent sees it next run. It also generates a
workspace map from `keel.json` (projects, repos, card links) as a marked Mermaid block that is
regenerated on command. No new diagram format.

## Part of a family

Keel Diagram is one of the keel Obsidian plugins, five open-source plugins that make Obsidian a
better surface for working with AI coding agents on a vault of specs, plans and boards. Each
plugin stands alone; together they follow one integration spec. They light up extra features
in a vault managed by [keel](https://github.com/JohannesMerwe/pangolin-keel), and stay useful
without it.

| Plugin | Does |
|---|---|
| [Keel Open Questions](https://github.com/JohannesMerwe/obsidian-open-questions) | agents ask questions in your notes; you answer with a click; decisions get logged |
| [Keel Board](https://github.com/JohannesMerwe/obsidian-board) | kanban over a folder of markdown cards; dragging moves the file |
| [Keel Cockpit](https://github.com/JohannesMerwe/obsidian-cockpit) | session context, keel verbs and handoff diff inside the vault |
| [Keel Keys](https://github.com/JohannesMerwe/obsidian-keys) | ticket-style ids as links, autocomplete and next-number creation |
| [Keel Diagram](https://github.com/JohannesMerwe/obsidian-diagram) | edit Mermaid and D2 in place; text stays the source of truth |

This plugin owns round-trip editing of fenced diagrams and the generated workspace map (SPEC-integration §C6).

## Principles

- Plain markdown first. No keel required.
- Integration with agents is files, not API calls. No keys, no network, no telemetry.
- Pure core in `src/core/` with no `obsidian` import, unit-tested; a thin Obsidian shell around it.

## Develop

```sh
npm install
npm run dev      # esbuild watch → main.js
npm run build    # tsc + esbuild production
npm run lint
```

Point a throwaway dev vault's `.obsidian/plugins/keel-diagram/` at this directory (or symlink
`main.js`, `manifest.json`, `styles.css`) and use the hot-reload plugin. Releases are
GitHub releases whose tag equals the `manifest.json` version; the workflow in
`.github/workflows/release.yml` builds and attaches the artifacts. Beta installs through BRAT.

## Agent skills

`agent/` will hold the same instructions in claude-skill and copilot-prompt formats, telling
an agent what convention this plugin renders and what it must never do. Copy them into your
agent's skills directory until keel links them for you.
