// Synthesised sound effects through WebAudio: no audio files, nothing loads over the
// network. The context is created on the first user gesture (browsers block audio before
// one); in a headless screenshot run it stays silent and never throws.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  /** A short tone: frequency slides from `from` to `to` over `seconds`. */
  function tone(from, to, seconds, type, gainValue) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
      gain.gain.setValueAtTime(gainValue, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + seconds + 0.02);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    pulse() {
      tone(180, 320, 0.18, 'sine', 0.05);
    },
    kill() {
      tone(520, 90, 0.16, 'triangle', 0.12);
    },
    ember() {
      tone(880, 1320, 0.09, 'sine', 0.07);
    },
    hit() {
      tone(160, 60, 0.25, 'sawtooth', 0.16);
    },
    flare() {
      tone(300, 900, 0.35, 'sine', 0.14);
      tone(90, 40, 0.4, 'triangle', 0.12);
    },
    level() {
      tone(523, 523, 0.1, 'sine', 0.1);
      window.setTimeout(() => tone(659, 659, 0.1, 'sine', 0.1), 90);
      window.setTimeout(() => tone(784, 1046, 0.22, 'sine', 0.12), 180);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, index) => {
        window.setTimeout(() => tone(freq, freq, 0.25, 'sine', 0.12), index * 130);
      });
    },
    lose() {
      tone(392, 98, 0.7, 'sawtooth', 0.12);
    },
  };
}
