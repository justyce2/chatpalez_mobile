const keyFor = (userId: number | string): string => `chatpalez.chat-sound.v1.${userId}`;
let audioContext: AudioContext | null = null;
const currentPreferences = new Map<string, boolean>();

export function isChatSoundEnabled(userId: number | string): boolean {
  const key = keyFor(userId);
  if (currentPreferences.has(key)) return currentPreferences.get(key)!;
  try { return window.localStorage.getItem(key) !== 'off'; }
  catch { return true; }
}

export function setChatSoundEnabled(userId: number | string, enabled: boolean): void {
  const key = keyFor(userId);
  currentPreferences.set(key, enabled);
  try { window.localStorage.setItem(key, enabled ? 'on' : 'off'); }
  catch { /* The current session still respects the chosen setting. */ }
}

export function unlockChatAudio(userId: number | string): void {
  if (!isChatSoundEnabled(userId)) return;
  try {
    if (!audioContext) audioContext = new window.AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch { /* Audio is optional. */ }
}

export function playSentChatSound(userId: number | string): void {
  playChatTone(userId, 660, 880);
}

export function playReceivedChatSound(userId: number | string): void {
  playChatTone(userId, 520, 700);
}

function playChatTone(userId: number | string, start: number, end: number): void {
  if (!isChatSoundEnabled(userId)) return;
  try {
    const context = audioContext;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(start, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
  } catch { /* Sound cannot block sending. */ }
}
