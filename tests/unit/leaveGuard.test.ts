import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';

afterEach(() => vi.restoreAllMocks());

describe('useLeaveGuard', () => {
  it('does nothing while inactive', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const onAttempt = vi.fn();
    renderHook(() => useLeaveGuard(false, onAttempt));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(push).not.toHaveBeenCalled();
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('puts a spare history entry on top when it becomes active', () => {
    const push = vi.spyOn(window.history, 'pushState');
    renderHook(() => useLeaveGuard(true, vi.fn()));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('on a back gesture, restores the spare entry and asks instead of leaving', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const onAttempt = vi.fn();
    renderHook(() => useLeaveGuard(true, onAttempt));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(push).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });

  it('asks the browser to confirm a reload or close while active', () => {
    renderHook(() => useLeaveGuard(true, vi.fn()));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not block a reload once the run is no longer active', () => {
    const { rerender } = renderHook(({ on }) => useLeaveGuard(on, vi.fn()), { initialProps: { on: true } });
    rerender({ on: false });
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('leave() goes back past both entries and stops intercepting', () => {
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});
    const onAttempt = vi.fn();
    const { result } = renderHook(() => useLeaveGuard(true, onAttempt));
    result.current.leave();
    expect(go).toHaveBeenCalledWith(-2);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onAttempt).not.toHaveBeenCalled();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
