/**
 * Original, simple Web Audio oscillator tones — no sampled/copyrighted
 * sounds. AudioContext is created lazily and only resumed from within a
 * user-gesture handler (Start Workout), satisfying browser autoplay
 * restrictions.
 */
class ToneController {
  private context: AudioContext | null = null;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Must be called synchronously inside the Start Workout click handler. */
  init(): void {
    if (typeof window === 'undefined') return;
    if (!this.context) {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.context = new AudioCtx();
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  private playTone(frequencies: number[], durationMs: number): void {
    if (!this.enabled || !this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const segmentDuration = durationMs / 1000 / frequencies.length;

    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      const start = now + i * segmentDuration;
      const end = start + segmentDuration;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    });
  }

  playExerciseStart(): void {
    this.playTone([523.25, 659.25], 220); // C5 -> E5, rising
  }

  playRestStart(): void {
    this.playTone([392.0], 260); // G4, single low tone
  }

  playWorkoutComplete(): void {
    this.playTone([523.25, 659.25, 783.99], 480); // C5-E5-G5, triumphant rise
  }

  release(): void {
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}

export const toneController = new ToneController();
