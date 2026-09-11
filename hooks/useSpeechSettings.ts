'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SPEECH_SETTINGS, speechController, type SpeechSettings } from '@/lib/speech/speech';

const STORAGE_KEY = 'workout-caller:speech-settings';
const TONES_STORAGE_KEY = 'workout-caller:tones-enabled';
const GET_READY_STORAGE_KEY = 'workout-caller:get-ready-seconds';

function loadSettings(): SpeechSettings {
  if (typeof window === 'undefined') return DEFAULT_SPEECH_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SPEECH_SETTINGS;
    return { ...DEFAULT_SPEECH_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SPEECH_SETTINGS;
  }
}

export function loadTonesEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(TONES_STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function loadGetReadySeconds(): number {
  if (typeof window === 'undefined') return 5;
  try {
    const raw = window.localStorage.getItem(GET_READY_STORAGE_KEY);
    return raw === null ? 5 : Number(raw);
  } catch {
    return 5;
  }
}

/** Persists all audio/speech/countdown preferences to localStorage and keeps the shared speechController in sync. */
export function useSpeechSettings() {
  const [settings, setSettings] = useState<SpeechSettings>(loadSettings);
  const [tonesEnabled, setTonesEnabledState] = useState<boolean>(loadTonesEnabled);
  const [getReadySeconds, setGetReadySecondsState] = useState<number>(loadGetReadySeconds);

  useEffect(() => {
    speechController.updateSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<SpeechSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setTonesEnabled = useCallback((enabled: boolean) => {
    setTonesEnabledState(enabled);
    window.localStorage.setItem(TONES_STORAGE_KEY, String(enabled));
  }, []);

  const setGetReadySeconds = useCallback((seconds: number) => {
    setGetReadySecondsState(seconds);
    window.localStorage.setItem(GET_READY_STORAGE_KEY, String(seconds));
  }, []);

  return { settings, updateSettings, tonesEnabled, setTonesEnabled, getReadySeconds, setGetReadySeconds };
}
