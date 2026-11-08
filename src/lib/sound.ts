/*
 * Short POS sounds, made with the Web Audio API (no audio files to load).
 *
 * - "tap":     bright two-note ping for the sale control buttons.
 * - "warn":    lower two-note ping for the buttons that remove or cancel (clear, delete, void).
 * - "success": rising three-note chime when a sale is saved.
 *
 * Browsers only allow sound after the user clicks or types, which is always the case here.
 * Sounds can be turned off with setSoundEnabled(false); the choice is kept in this browser.
 */

export type PosSound = 'tap' | 'warn' | 'success';

const SOUND_KEY = 'dagohoy_pos_sound';

type Note = { frequency: number; start: number; length: number; volume: number };

const SOUNDS: Record<PosSound, Note[]> = {
  tap: [
    { frequency: 1318.5, start: 0, length: 0.09, volume: 0.22 }, // E6
    { frequency: 1760, start: 0.07, length: 0.14, volume: 0.2 }, // A6
  ],
  warn: [
    { frequency: 880, start: 0, length: 0.1, volume: 0.24 }, // A5
    { frequency: 659.3, start: 0.09, length: 0.18, volume: 0.22 }, // E5
  ],
  success: [
    { frequency: 1046.5, start: 0, length: 0.14, volume: 0.22 }, // C6
    { frequency: 1318.5, start: 0.1, length: 0.14, volume: 0.22 }, // E6
    { frequency: 1568, start: 0.2, length: 0.34, volume: 0.24 }, // G6
  ],
};

let context: AudioContext | null = null;

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  } catch {
    // Storage blocked: the sound simply stays at its default.
  }
}

export function playSound(sound: PosSound) {
  if (!isSoundEnabled()) return;
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  try {
    context ??= new AudioCtor();
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    for (const note of SOUNDS[sound]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note.frequency;
      // Quick attack, smooth fade: a bell-like ping without clicks.
      const start = now + note.start;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + note.length + 0.02);
    }
  } catch {
    // Audio is a nice-to-have; never let it break a sale.
  }
}
