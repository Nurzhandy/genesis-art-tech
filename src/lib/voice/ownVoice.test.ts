import { describe, expect, it } from 'vitest';
import { UploadRequest } from '@/lib/validation';
import { isOwnVoice, ownVoicePreset, pickRecordingType, recordingExt } from './ownVoice';

describe('свой голос (C5)', () => {
  it('расширение по типу записи браузера', () => {
    expect(recordingExt('audio/webm;codecs=opus')).toBe('webm');
    expect(recordingExt('audio/mp4')).toBe('m4a');
    expect(recordingExt('audio/ogg; codecs=opus')).toBe('ogg');
  });
  it('выбирает первый поддерживаемый тип', () => {
    expect(pickRecordingType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecordingType(() => false)).toBeUndefined();
  });
  it('пресет своего голоса узнаётся и объясняет «ваш голос»', () => {
    expect(isOwnVoice(ownVoicePreset())).toBe(true);
    expect(ownVoicePreset().because).toBe('ваш голос');
    expect(isOwnVoice({ voice: 'nova', speed: 1, instructions: '', because: '' })).toBe(false);
  });
  it('загрузка kind voice принимает только аудио-расширения', () => {
    expect(UploadRequest.safeParse({ files: [{ kind: 'voice', ext: 'webm' }] }).success).toBe(true);
    expect(UploadRequest.safeParse({ files: [{ kind: 'voice', ext: 'exe' }] }).success).toBe(false);
  });
});
