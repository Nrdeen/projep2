import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, unknown>;
  return (win.SpeechRecognition || win.webkitSpeechRecognition || null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDurationMmSs(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export type AiVoiceLangSetting = 'auto' | 'ar-SA' | 'en-US';

export function useAiVoice({
  isEn,
  voiceLang = 'auto',
  serverTtsEnabled,
  serverSttEnabled,
  onTranscript,
}: {
  isEn: boolean;
  voiceLang?: AiVoiceLangSetting;
  serverTtsEnabled: boolean;
  serverSttEnabled: boolean;
  onTranscript: (text: string) => void;
}) {
  const effectiveLang =
    voiceLang === 'en-US' ? 'en-US' : voiceLang === 'ar-SA' ? 'ar-SA' : isEn ? 'en-US' : 'ar-SA';
  const locale: 'ar' | 'en' = effectiveLang.startsWith('en') ? 'en' : 'ar';

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const finalizedTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const timerRef = useRef<number | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const hasWebSpeech = Boolean(getSpeechRecognitionCtor());
  const hasMediaRecorder =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator?.mediaDevices?.getUserMedia);

  const sttSupported = hasWebSpeech || (hasMediaRecorder && serverSttEnabled);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    setDurationSeconds(0);
    timerRef.current = window.setInterval(() => {
      setDurationSeconds((s) => s + 1);
    }, 1000);
  }, [clearTimer]);

  const mapMicError = useCallback(
    (code: string) => {
      if (code === 'not-allowed' || code === 'NotAllowedError' || code === 'PermissionDeniedError') {
        return isEn
          ? 'Microphone permission denied. Please allow microphone access in your browser.'
          : 'تم رفض إذن الميكروفون. يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح.';
      }
      if (code === 'audio-capture' || code === 'NotFoundError' || code === 'DevicesNotFoundError') {
        return isEn
          ? 'No microphone was found on this device.'
          : 'لم يتم العثور على ميكروفون متصل بهذا الجهاز.';
      }
      return isEn
        ? 'Could not record audio right now. You can type your message directly.'
        : 'تعذر التسجيل الصوتي الآن. يمكنك كتابة رسالتك مباشرة.';
    },
    [isEn]
  );

  const startMediaRecorderFallback = useCallback(async () => {
    if (!hasMediaRecorder) {
      setVoiceError(
        isEn
          ? 'Voice input is not supported in this browser.'
          : 'المتصفح الحالي لا يدعم الإدخال الصوتي.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType =
        preferredTypes.find((type) =>
          typeof MediaRecorder.isTypeSupported === 'function' ? MediaRecorder.isTypeSupported(type) : false
        ) || '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        clearTimer();
        stopMediaStream();
        setRecording(false);
        mediaRecorderRef.current = null;

        if (cancelledRef.current || chunksRef.current.length === 0) {
          chunksRef.current = [];
          return;
        }

        const blobType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        chunksRef.current = [];

        if (!serverSttEnabled) {
          setVoiceError(
            isEn
              ? 'Server speech-to-text requires Gemini API to be configured. Please type or use a supported browser.'
              : 'تحويل الصوت عبر الخادم يتطلب تفعيل الخدمة الصوتية. يمكنك الكتابة مباشرة.'
          );
          return;
        }

        setTranscribing(true);
        try {
          const ext = blobType.includes('ogg')
            ? 'ogg'
            : blobType.includes('mp4')
            ? 'm4a'
            : blobType.includes('wav')
            ? 'wav'
            : 'webm';
          const res = await api.transcribeAiAudio(blob, locale, `voice.${ext}`);
          if (res.text?.trim()) {
            onTranscript(res.text.trim());
          } else {
            setVoiceError(
              isEn
                ? 'No clear speech detected. Please try again.'
                : 'لم يتم التقاط كلام واضح، حاول التحدث بوضوح مرة أخرى.'
            );
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          setVoiceError(
            msg ||
              (isEn ? 'Could not transcribe audio.' : 'تعذر تحويل الصوت إلى نص الآن.')
          );
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      startTimer();
    } catch (err: unknown) {
      stopMediaStream();
      clearTimer();
      setRecording(false);
      const errName = err instanceof DOMException ? err.name : '';
      setVoiceError(mapMicError(errName));
    }
  }, [
    clearTimer,
    hasMediaRecorder,
    isEn,
    locale,
    mapMicError,
    onTranscript,
    serverSttEnabled,
    startTimer,
    stopMediaStream,
  ]);

  const startRecording = useCallback(async () => {
    setVoiceError(null);
    if (recording || transcribing) return;

    if (!sttSupported) {
      setVoiceError(
        isEn
          ? 'Voice recording is not supported in this browser.'
          : 'التسجيل الصوتي غير مدعوم في هذا المتصفح.'
      );
      return;
    }

    const SpeechCtor = getSpeechRecognitionCtor();
    if (SpeechCtor) {
      try {
        const rec = new SpeechCtor();
        rec.lang = effectiveLang;
        rec.continuous = true;
        rec.interimResults = true;
        cancelledRef.current = false;
        finalizedTranscriptRef.current = '';
        interimTranscriptRef.current = '';
        setInterimText('');

        rec.onresult = (event) => {
          let finalized = '';
          let interim = '';
          for (let idx = 0; idx < event.results.length; idx += 1) {
            const result = event.results[idx];
            const piece = result[0]?.transcript || '';
            if (result.isFinal) {
              finalized += `${piece} `;
            } else {
              interim += `${piece} `;
            }
          }
          finalizedTranscriptRef.current = finalized.trim();
          interimTranscriptRef.current = interim.trim();
          setInterimText(`${finalized} ${interim}`.trim());
        };

        rec.onerror = (event) => {
          const errCode = event?.error || '';
          if (errCode === 'aborted' || cancelledRef.current) return;
          if (errCode === 'no-speech') return;
          if (
            (errCode === 'service-not-allowed' ||
              errCode === 'language-not-supported' ||
              errCode === 'network') &&
            hasMediaRecorder &&
            serverSttEnabled
          ) {
            // Switch seamlessly to MediaRecorder + server STT fallback
            cancelledRef.current = true;
            try {
              rec.abort();
            } catch {
              // ignore
            }
            recognitionRef.current = null;
            clearTimer();
            setInterimText('');
            setRecording(false);
            void startMediaRecorderFallback();
            return;
          }
          clearTimer();
          setRecording(false);
          setInterimText('');
          recognitionRef.current = null;
          setVoiceError(mapMicError(errCode));
        };

        rec.onend = () => {
          clearTimer();
          setRecording(false);
          recognitionRef.current = null;
          const combined = [
            finalizedTranscriptRef.current,
            interimTranscriptRef.current,
          ]
            .filter(Boolean)
            .join(' ')
            .trim();
          setInterimText('');
          if (!cancelledRef.current && combined) {
            onTranscript(combined);
          }
          finalizedTranscriptRef.current = '';
          interimTranscriptRef.current = '';
        };

        recognitionRef.current = rec;
        rec.start();
        setRecording(true);
        startTimer();
        return;
      } catch {
        recognitionRef.current = null;
        clearTimer();
      }
    }

    await startMediaRecorderFallback();
  }, [
    clearTimer,
    effectiveLang,
    hasMediaRecorder,
    isEn,
    mapMicError,
    onTranscript,
    recording,
    serverSttEnabled,
    startMediaRecorderFallback,
    startTimer,
    sttSupported,
    transcribing,
  ]);

  const stopRecording = useCallback(() => {
    cancelledRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        clearTimer();
        setRecording(false);
      }
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      return;
    }
    clearTimer();
    setRecording(false);
  }, [clearTimer]);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setInterimText('');
    clearTimer();
    setRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    stopMediaStream();
  }, [clearTimer, stopMediaStream]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setPlayingMessageId(null);
    setTtsLoadingId(null);
  }, []);

  const toggleSpeak = useCallback(
    async (messageId: string, rawText: string) => {
      setVoiceError(null);
      if (playingMessageId === messageId || ttsLoadingId === messageId) {
        stopSpeaking();
        return;
      }

      stopSpeaking();
      const spokenText = stripMarkdownForSpeech(rawText);
      if (!spokenText) return;

      const speakWithBrowser = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          return false;
        }
        try {
          const utterance = new SpeechSynthesisUtterance(spokenText.slice(0, 1200));
          const targetLang = effectiveLang;
          utterance.lang = targetLang;
          const voices = window.speechSynthesis.getVoices();
          const preferred =
            voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
            voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.startsWith('en') ? 'en' : 'ar'));
          if (preferred) utterance.voice = preferred;
          utterance.onend = () => setPlayingMessageId(null);
          utterance.onerror = () => setPlayingMessageId(null);
          setPlayingMessageId(messageId);
          window.speechSynthesis.speak(utterance);
          return true;
        } catch {
          return false;
        }
      };

      if (serverTtsEnabled) {
        setTtsLoadingId(messageId);
        try {
          const res = await api.synthesizeAiSpeech(spokenText, locale);
          const binary = atob(res.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: res.mimeType || 'audio/wav' });
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          const audio = new Audio(url);
          audioElRef.current = audio;
          audio.onended = () => {
            stopSpeaking();
          };
          audio.onerror = () => {
            stopSpeaking();
          };
          setTtsLoadingId(null);
          setPlayingMessageId(messageId);
          await audio.play();
          return;
        } catch {
          setTtsLoadingId(null);
          if (speakWithBrowser()) return;
          setVoiceError(
            isEn
              ? 'Text-to-speech playback is not supported right now.'
              : 'تعذر تشغيل القراءة الصوتية حالياً.'
          );
          return;
        }
      }

      if (!speakWithBrowser()) {
        setVoiceError(
          isEn
            ? 'Text-to-speech is not supported in this browser.'
            : 'القراءة الصوتية غير مدعومة في هذا المتصفح.'
        );
      }
    },
    [effectiveLang, isEn, locale, playingMessageId, serverTtsEnabled, stopSpeaking, ttsLoadingId]
  );

  useEffect(() => {
    return () => {
      cancelRecording();
      stopSpeaking();
    };
  }, [cancelRecording, stopSpeaking]);

  return {
    recording,
    transcribing,
    durationSeconds,
    interimText,
    voiceError,
    clearVoiceError: () => setVoiceError(null),
    sttSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    playingMessageId,
    ttsLoadingId,
    toggleSpeak,
    stopSpeaking,
  };
}
