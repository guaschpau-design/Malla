import { statfsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import { DiskSpace } from './disk-space.ts';

describe('disk space', () => {
  it('has room while more than the minimum is free, and says when it runs short', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const stats = statfsSync(tmpdir());
    const free = stats.bavail * stats.bsize;
    expect(new DiskSpace(tmpdir(), 0).hasRoom()).toBe(true);
    expect(new DiskSpace(tmpdir(), free * 2).hasRoom()).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
