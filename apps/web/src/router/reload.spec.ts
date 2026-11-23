import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadOnce } from './index';

describe('reloadOnce', () => {
  const assign = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    assign.mockReset();
  });

  it('recharge une fois, pas en boucle', () => {
    reloadOnce('/share');
    reloadOnce('/share');
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/share');
  });

  it('recharge pour une autre adresse', () => {
    reloadOnce('/alone');
    reloadOnce('/together');
    expect(assign).toHaveBeenCalledTimes(2);
  });
});
