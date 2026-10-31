// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adminApi } from './api';

function okJson() {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
}

describe('adminApi.analytics query building', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => okJson());
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  function calledUrl(): string {
    return String(fetchSpy.mock.calls[0][0]);
  }

  it('sends a named range as ?range=', async () => {
    await adminApi.analytics({ range: '7d' });
    expect(calledUrl()).toContain('/admin/metrics/analytics?range=7d');
    expect(calledUrl()).not.toContain('from=');
  });

  it('sends a custom range as ?from=&to= and never a range token', async () => {
    await adminApi.analytics({ range: 'custom', from: '2026-03-01', to: '2026-03-03' });
    const url = calledUrl();
    expect(url).toContain('from=2026-03-01');
    expect(url).toContain('to=2026-03-03');
    expect(url).not.toContain('range=custom');
  });

  it('adds compare=true only when requested', async () => {
    await adminApi.analytics({ range: '30d', compare: true });
    expect(calledUrl()).toContain('compare=true');
  });

  it('omits the query string entirely with no params', async () => {
    await adminApi.analytics();
    expect(calledUrl()).toMatch(/\/admin\/metrics\/analytics$/);
  });
});
