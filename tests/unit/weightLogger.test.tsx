import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WeightLogger } from '@/components/workout-run/WeightLogger';

const setup = (props: Partial<Parameters<typeof WeightLogger>[0]> = {}) => {
  const onLog = vi.fn();
  render(<WeightLogger label="Goblet Squat · set 2" logged={null} suggestion={null} onLog={onLog} {...props} />);
  return { onLog };
};

describe('WeightLogger', () => {
  it('with no history it is just a quiet link, so bodyweight exercises are not nagged', () => {
    setup();
    expect(screen.getByRole('button', { name: '+ Log weight' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('tapping the link opens an empty field; + records 5 lb straight away', () => {
    const { onLog } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Log weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Raise weight by 5 pounds' }));
    expect(onLog).toHaveBeenCalledWith(5);
  });

  it('with a suggestion the field is pre-filled and one tap on Log records it', () => {
    const { onLog } = setup({ suggestion: 25 });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('25');
    expect(onLog).not.toHaveBeenCalled(); // nothing is recorded until the person confirms
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(onLog).toHaveBeenCalledWith(25);
  });

  it('+ and - adjust from the suggestion by 5 lb and record immediately', () => {
    const { onLog } = setup({ suggestion: 25 });
    fireEvent.click(screen.getByRole('button', { name: 'Raise weight by 5 pounds' }));
    expect(onLog).toHaveBeenLastCalledWith(30);
  });

  it('typing a weight records it when the field loses focus', () => {
    const { onLog } = setup({ suggestion: 25 });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '27.5' } });
    expect(onLog).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onLog).toHaveBeenCalledWith(27.5);
  });

  it('once recorded it shows what was logged instead of a Log button', () => {
    setup({ logged: 30, suggestion: 25 });
    expect(screen.queryByRole('button', { name: 'Log' })).toBeNull();
    expect(screen.getByText(/✓ 30 lb/)).toBeTruthy();
  });

  it('clearing a recorded weight removes it', () => {
    const { onLog } = setup({ logged: 30 });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onLog).toHaveBeenCalledWith(null);
  });

  it('never goes below zero', () => {
    const { onLog } = setup({ logged: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Lower weight by 5 pounds' }));
    expect(onLog).toHaveBeenCalledWith(0);
  });

  it('does not record anything for junk text', () => {
    const { onLog } = setup({ suggestion: 25 });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onLog).not.toHaveBeenCalled();
  });
});
