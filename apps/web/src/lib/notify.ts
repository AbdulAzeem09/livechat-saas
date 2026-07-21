// Lightweight agent alerting helpers so incoming chats are never missed.
// Sound is synthesized with the Web Audio API (no asset to download).

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new Ctor();
  }

  return audioContext;
}

/**
 * Unlock Web Audio on a user gesture. Browsers keep the AudioContext suspended
 * until the user interacts with the page, so the first chime would be silent.
 * Call this from a click/keydown handler once after the dashboard loads.
 */
export function primeAudio(): void {
  try {
    const ctx = getAudioContext();

    if (!ctx) {
      return;
    }

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    // A near-silent blip fully unlocks audio on stricter browsers (Safari/iOS).
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.gain.value = 0.00001;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.02);
  } catch {
    // best-effort
  }
}

/** Play a short two-tone "ping" to alert the agent of a new chat/message. */
export function playChime(): void {
  try {
    const ctx = getAudioContext();

    if (!ctx) {
      return;
    }

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    [880, 1320].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * 0.12;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.24);
    });
  } catch {
    // Audio is best-effort; never break the app for a failed chime.
  }
}

/** Ask the browser for notification permission (once). Call after a user gesture. */
export function requestNotificationPermission(): void {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    // ignore
  }
}

/** Show a desktop notification when the dashboard tab is not in the foreground. */
export function showBrowserNotification(title: string, body: string): void {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    // Only surface a desktop notification when the agent is looking elsewhere;
    // an in-app alert + sound covers the focused case.
    if (document.visibilityState === "visible") {
      return;
    }

    const notification = new Notification(title, { body, tag: "livechat-incoming" });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // ignore
  }
}
