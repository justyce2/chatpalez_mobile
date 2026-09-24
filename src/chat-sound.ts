const keyFor = (userId: number | string): string => `chatpalez.chat-sound.v1.${userId}`;
let audioContext: AudioContext | null = null;

export function isChatSoundEnabled(userId: number | string): boolean {
  try { return window.localStorage.getItem(keyFor(userId)) !== 'off'; }
  catch { return true; }
}

export function setChatSoundEnabled(userId: number | string, enabled: boolean): void {
  try { window.localStorage.setItem(keyFor(userId), enabled ? 'on' : 'off'); }
  catch { /* The preference remains at its default when storage is unavailable. */ }
}

export function unlockChatAudio(userId: number | string): void {
  if (!isChatSoundEnabled(userId)) return;
  try {
    audioContext ??= new window.AudioContext();
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
