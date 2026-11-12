import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MoreMenu } from '@/components/ui/MoreMenu';
import { WorkoutActionBar } from '@/components/editor/WorkoutActionBar';

function setup() {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <MoreMenu
      items={[
        { label: 'Edit', onSelect: onEdit },
        { label: 'Delete', danger: true, onSelect: onDelete },
      ]}
    />,
  );
  return { onEdit, onDelete, trigger: screen.getByRole('button', { name: 'More actions' }) };
}

describe('MoreMenu', () => {
  it('is closed at first and exposes its state to assistive tech', () => {
    const { trigger } = setup();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on tap, listing every action', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitem').map((e) => e.textContent)).toEqual(['Edit', 'Delete']);
  });

  it('runs the chosen action once and closes', () => {
    const { trigger, onEdit, onDelete } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape without running anything', () => {
    const { trigger, onEdit, onDelete } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('closes when tapping outside', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('WorkoutActionBar', () => {
  it('has Start Workout, Save as template and Schedule, all clickable when allowed', () => {
    const onStart = vi.fn();
    const onSave = vi.fn();
    const onSchedule = vi.fn();
    render(<WorkoutActionBar canStart onStart={onStart} onSaveAsTemplate={onSave} onSchedule={onSchedule} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save as template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect([onStart, onSave, onSchedule].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('disables every action while the workout is not valid', () => {
    render(<WorkoutActionBar canStart={false} onStart={() => {}} onSaveAsTemplate={() => {}} onSchedule={() => {}} />);
    for (const b of screen.getAllByRole('button')) expect((b as HTMLButtonElement).disabled).toBe(true);
  });
});
