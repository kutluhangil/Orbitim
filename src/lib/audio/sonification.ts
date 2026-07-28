import type { SkyEvent } from '../ephemeris/events';

const EVENT_PULSES: Record<SkyEvent['id'], number> = {
  full: 2,
  new: 1,
  solar: 4,
  lunar: 3,
  transit: 2,
  conjunction: 2
};

export interface SonificationResult {
  durationMs: number;
  pitchHz: number;
  pulses: number;
}

/**
 * A short, user-triggered data sonification. It is not a recording: pitch maps
 * days until the event and pulse count maps the event class, both stated in UI.
 */
export async function sonifySkyEvent(event: SkyEvent, now: Date): Promise<SonificationResult> {
  if (!window.AudioContext) throw new Error('This browser does not support the Web Audio API.');

  const days = Math.max(0, (event.date.getTime() - now.getTime()) / 86_400_000);
  const pitchHz = 180 + Math.min(days, 365) / 365 * 540;
  const pulses = EVENT_PULSES[event.id];
  const durationMs = pulses * 190 + (pulses - 1) * 90;
  const context = new window.AudioContext();
  await context.resume();

  for (let index = 0; index < pulses; index++) {
    const offset = index * 0.28;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = event.id === 'solar' || event.id === 'lunar' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(pitchHz, context.currentTime + offset);
    gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + offset + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + 0.19);
  }

  await new Promise<void>((resolve) => window.setTimeout(resolve, durationMs + 60));
  await context.close();
  return { durationMs, pitchHz, pulses };
}
