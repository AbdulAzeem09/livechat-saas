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

export type VoiceGender = "female" | "male";

// Voices load asynchronously in some browsers; cache them and refresh on change.
let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    loadVoices();
  });
}

/** Pick the best-matching English voice for the requested gender, with fallbacks. */
function pickVoice(gender: VoiceGender): SpeechSynthesisVoice | null {
  const voices = loadVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const pool = voices.length > 0 ? voices : cachedVoices;
  if (pool.length === 0) {
    return null;
  }

  const femaleHints = ["female", "zira", "samantha", "victoria", "susan", "karen", "moira", "tessa", "fiona", "google us english"];
  const maleHints = ["male", "david", "mark", "daniel", "alex", "fred", "george", "james", "google uk english male"];
  const wanted = gender === "female" ? femaleHints : maleHints;
  const avoid = gender === "female" ? maleHints : femaleHints;

  const match = pool.find((voice) => {
    const name = voice.name.toLowerCase();
    return wanted.some((hint) => name.includes(hint));
  });
  if (match) {
    return match;
  }

  // Fall back to any voice that at least isn't obviously the other gender.
  const neutral = pool.find((voice) => {
    const name = voice.name.toLowerCase();
    return !avoid.some((hint) => name.includes(hint));
  });
  return neutral ?? pool[0] ?? null;
}

/**
 * Speak a short phrase aloud (e.g. "New visitor") in a male or female voice using
 * the browser's Speech Synthesis. Best-effort: silently no-ops if unsupported.
 */
export function speak(text: string, gender: VoiceGender = "female"): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    const synth = window.speechSynthesis;
    // Drop any queued phrase so alerts don't stack up during a rush of visitors.
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(gender);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = 1;
    utterance.pitch = gender === "female" ? 1.15 : 0.85;
    utterance.volume = 1;
    synth.speak(utterance);
  } catch {
    // Speech is best-effort; never break the app for a failed announcement.
  }
}
