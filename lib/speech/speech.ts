import type { Segment } from '@/lib/workout/engine';

export type CountdownAnnouncementSetting = 'off' | 'last3' | 'last5';
export type RestAnnouncementStyle = 'restOnly' | 'restAndNext';

export interface SpeechSettings {
  voiceAnnouncementsEnabled: boolean;
  countdownAnnouncements: CountdownAnnouncementSetting;
  announceDuration: boolean;
  restAnnouncementStyle: RestAnnouncementStyle;
  voiceURI: string | null;
  rate: number;
  volume: number;
}

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  voiceAnnouncementsEnabled: true,
  countdownAnnouncements: 'last3',
  announceDuration: true,
  restAnnouncementStyle: 'restAndNext',
  voiceURI: null,
  rate: 1.0,
  volume: 1.0,
};

/**
 * Thin, cancel-safe wrapper around window.speechSynthesis. Every speak()
 * call cancels any in-flight utterance first — this is what the spec
 * requires to prevent overlapping/duplicate announcements across a fast
 * skip or interval transition. A module-level singleton is appropriate
 * here: there is exactly one active workout run at a time, and
 * speechSynthesis itself is a single global resource in the browser.
 */
class SpeechController {
  private settings: SpeechSettings = DEFAULT_SPEECH_SETTINGS;

  updateSettings(settings: SpeechSettings): void {
    this.settings = settings;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Must be called synchronously inside the Start Workout click handler (a user gesture) to satisfy iOS's speech-synthesis activation requirement. */
  prime(): void {
    if (!this.isSupported()) return;
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  }

  speak(text: string): void {
    if (!this.settings.voiceAnnouncementsEnabled || !this.isSupported() || text.trim() === '') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.settings.rate;
    utterance.volume = this.settings.volume;
    if (this.settings.voiceURI) {
      const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === this.settings.voiceURI);
      if (voice) utterance.voice = voice;
    }
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}

export const speechController = new SpeechController();

/** Builds the short announcement text for entering a new segment. */
export function buildSegmentAnnouncement(
  segment: Segment,
  settings: SpeechSettings,
  nextSegment: Segment | null,
): string {
  if (segment.announce) return segment.announce;

  if (segment.kind === 'rest' || segment.kind === 'roundRest') {
    if (settings.restAnnouncementStyle === 'restAndNext' && nextSegment) {
      return `Rest. Next: ${nextSegment.name}.`;
    }
    return 'Rest.';
  }

  if (segment.reps !== null) {
    return `${segment.name}. ${segment.reps} reps.`;
  }
  if (settings.announceDuration && segment.durationSeconds !== null) {
    return `${segment.name}. ${segment.durationSeconds} seconds.`;
  }
  return `${segment.name}.`;
}

export function buildRoundAnnouncement(roundNumber: number): string {
  return `Round ${roundNumber}.`;
}

const COUNTDOWN_THRESHOLD: Record<CountdownAnnouncementSetting, number> = {
  off: 0,
  last3: 3,
  last5: 5,
};

/** Whole seconds (descending) that should be spoken as the segment nears its end, per the countdown setting. */
export function countdownThresholdSeconds(setting: CountdownAnnouncementSetting): number {
  return COUNTDOWN_THRESHOLD[setting];
}
