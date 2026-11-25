import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X } from 'lucide-react';

interface AiCameraModalProps {
  open: boolean;
  isEn: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onFallbackFilePicker: () => void;
}

export function AiCameraModal({
  open,
  isEn,
  onClose,
  onCapture,
  onFallbackFilePicker,
}: AiCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setReady(false);

    const stopStream = () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
    };

    const startCamera = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setError(
          isEn
            ? 'Direct camera preview is not supported in this browser.'
            : 'معاينة الكاميرا المباشرة غير مدعومة في هذا المتصفح.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err: unknown) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError(
            isEn
              ? 'Camera permission denied. Allow camera access or choose an image file.'
              : 'تم رفض إذن الكاميرا. يمكنك السماح للكاميرا أو اختيار صورة من الجهاز.'
          );
        } else {
          setError(
            isEn
              ? 'No active camera found. You can choose an image from your device.'
              : 'تعذر فتح الكاميرا. يمكنك اختيار صورة من الجهاز مباشرة.'
          );
        }
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facingMode, isEn]);

  if (!open) return null;

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        onClose();
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col bg-[#0E1814] text-white"
      role="dialog"
      aria-label={isEn ? 'Take a photo' : 'التقاط صورة'}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-[#103B2D] border-b border-white/10">
        <span className="font-display text-sm font-bold">
          {isEn ? 'Take photo for analysis' : 'التقاط صورة للتحليل'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
            aria-label={isEn ? 'Switch camera' : 'تبديل الكاميرا'}
            title={isEn ? 'Switch camera' : 'تبديل الكاميرا'}
            className="w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close camera' : 'إغلاق الكاميرا'}
            className="w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center bg-black relative p-3">
        {error ? (
          <div className="max-w-[28ch] text-center space-y-3">
            <p className="text-xs text-red-200 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onFallbackFilePicker();
              }}
              className="px-4 py-2 rounded-xl bg-[#B99A56] text-[#103B2D] text-xs font-bold cursor-pointer hover:opacity-95"
            >
              {isEn ? 'Choose image file instead' : 'اختيار صورة من الجهاز'}
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        )}
      </div>

      {!error && (
        <div className="px-4 py-3 bg-[#103B2D] flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={!ready}
            onClick={handleCapture}
            className="px-5 py-2.5 rounded-full bg-[#B99A56] text-[#103B2D] font-bold text-xs inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Camera size={16} aria-hidden="true" />
            <span>{isEn ? 'Capture photo' : 'التقاط الصورة'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
