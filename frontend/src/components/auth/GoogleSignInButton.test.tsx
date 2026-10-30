// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

const configMock = vi.fn();
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, authApi: { ...actual.authApi, config: () => configMock() } };
});

import { GoogleSignInButton } from './GoogleSignInButton';

let renderButton: ReturnType<typeof vi.fn>;
let resizeCb: ResizeObserverCallback | null;

beforeEach(() => {
  cleanup();
  configMock.mockReset().mockResolvedValue({ googleClientId: 'cid' });
  renderButton = vi.fn();
  (window as any).google = { accounts: { id: { initialize: vi.fn(), renderButton } } };
  resizeCb = null;
  (global as any).ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) { resizeCb = cb; }
    observe() {}
    disconnect() {}
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (window as any).google;
  delete (global as any).ResizeObserver;
});

function mockContainerWidth(w: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { width: w, height: 44, top: 0, left: 0, right: w, bottom: 44, x: 0, y: 0, toJSON() {} } as DOMRect);
}

describe('GoogleSignInButton width clamp', () => {
  it.each([
    [280, 280],
    [320, 320],
    [375, 375],
    [390, 390],
    [430, 400],
    [700, 400],
  ])('container %ipx draws the button at %ipx and never wider than the container', async (container, expected) => {
    mockContainerWidth(container);
    render(<GoogleSignInButton onCredential={() => {}} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    const opts = renderButton.mock.calls[0][1];
    expect(opts.width).toBe(expected);
    expect(opts.width).toBeLessThanOrEqual(container);
    expect(opts.text).toBe('continue_with');
  });
});

describe('GoogleSignInButton redraw behaviour', () => {
  it('redraws once (debounced) when the container width changes by more than 40px', async () => {
    mockContainerWidth(320);
    render(<GoogleSignInButton onCredential={() => {}} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    mockContainerWidth(400); // +80px, over the 40px threshold
    resizeCb?.([], {} as ResizeObserver);
    resizeCb?.([], {} as ResizeObserver); // extra fire within the debounce window
    vi.advanceTimersByTime(150);
    expect(renderButton).toHaveBeenCalledTimes(2); // exactly one redraw
    expect(renderButton.mock.calls[1][1].width).toBe(400);
  });

  it('does not redraw for a container width change of 40px or less', async () => {
    mockContainerWidth(320);
    render(<GoogleSignInButton onCredential={() => {}} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    mockContainerWidth(350); // +30px, under the threshold
    resizeCb?.([], {} as ResizeObserver);
    vi.advanceTimersByTime(150);
    expect(renderButton).toHaveBeenCalledTimes(1);
  });

  it('a new callback prop (as typing would cause) does not redraw the button', async () => {
    mockContainerWidth(360);
    const { rerender } = render(<GoogleSignInButton onCredential={() => {}} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    rerender(<GoogleSignInButton onCredential={() => {}} />); // different inline callback
    rerender(<GoogleSignInButton onCredential={() => {}} />);
    expect(renderButton).toHaveBeenCalledTimes(1);
  });
});
