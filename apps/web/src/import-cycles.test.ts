// No module of the app may import itself back through others, not even for a type: a cycle makes
// the order in which modules load matter, and hides which of them is the lower level. The audit of
// 27 October 2026 found several; this keeps them out.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SOURCE = dirname(fileURLToPath(import.meta.url));
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;

/** Every module of the app (tests aside), with the modules it imports. */
function importGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const entry of readdirSync(SOURCE, { recursive: true, withFileTypes: true })) {
    const name = entry.name;
    if (!entry.isFile() || !/\.(ts|svelte)$/.test(name) || name.includes('.test.')) continue;
    const path = join(entry.parentPath, name);
    const text = readFileSync(path, 'utf8');
    const imports = [...text.matchAll(RELATIVE_IMPORT)].map(([, spec = '']) =>
      normalize(join(entry.parentPath, spec)),
    );
    graph.set(path, imports);
  }
  return graph;
}

/** One cycle of the graph, as the modules on it, or null if there is none. */
function findCycle(graph: Map<string, string[]>): string[] | null {
  const done = new Set<string>();
  const path: string[] = [];
  const onPath = new Set<string>();
  const visit = (module: string): string[] | null => {
    if (onPath.has(module)) return [...path.slice(path.indexOf(module)), module];
    if (done.has(module) || !graph.has(module)) return null;
    path.push(module);
    onPath.add(module);
    for (const next of graph.get(module) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    onPath.delete(module);
    done.add(module);
    return null;
  };
  for (const module of graph.keys()) {
    const cycle = visit(module);
    if (cycle) return cycle;
  }
  return null;
}

describe('imports', () => {
  it('form no cycles', () => {
    const cycle = findCycle(importGraph());
    const shown = cycle === null ? null : cycle.map((module) => module.slice(SOURCE.length + 1));
    expect(shown).toBeNull();
  });

  it('are found, so that a cycle would be', () => {
    expect(importGraph().get(join(SOURCE, 'main.ts'))).toContain(join(SOURCE, 'App.svelte'));
  });
});
