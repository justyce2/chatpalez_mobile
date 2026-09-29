import { VoiceRecorder } from '@independo/capacitor-voice-recorder';

function base64ToFile(base64: string, mimeType: string, name: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mimeType || 'audio/mp4' });
}

export async function recordVoiceNote(): Promise<File | null> {
  const capability = await VoiceRecorder.canDeviceVoiceRecord();
  if (!capability.value) throw new Error('Voice recording is not available on this device.');
  const permission = await VoiceRecorder.requestAudioRecordingPermission();
  if (!permission.value) throw new Error('Microphone permission was not granted.');
  await VoiceRecorder.startRecording();
  const result = await VoiceRecorder.stopRecording();
  const data = result.value;
  if (!data?.recordDataBase64) throw new Error('The voice recording could not be read.');
  const extension = data.fileExtension || (data.mimeType.includes('mp4') ? 'm4a' : data.mimeType.includes('aac') ? 'aac' : 'audio');
  return base64ToFile(data.recordDataBase64, data.mimeType, `voice-note-${Date.now()}.${extension}`);
}
