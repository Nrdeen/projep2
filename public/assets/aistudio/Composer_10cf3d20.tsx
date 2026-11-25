import { useLayoutEffect, useRef, type ClipboardEvent, type DragEvent, type KeyboardEvent, type RefObject } from 'react';
import { ASSISTANT_LIMITS } from '../../shared/types';
import type { PendingAttachment } from '../hooks/useAssistant';
import type { useVoiceInput } from '../hooks/useVoiceInput';
import { formatBytes, formatDuration } from '../utils/format';
import type { Strings } from '../utils/i18n';
import { IconCheck, IconClip, IconFile, IconMic, IconSend, IconSpinner, IconStop, IconX } from './Icons';

export interface ComposerProps {
  s: Strings;
  text: string;
  onText: (t: string) => void;
  busy: boolean;
  disabled?: boolean;
  attachments: PendingAttachment[];
  attachmentProblem: string | null;
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  onStop: () => void;
  voice: ReturnType<typeof useVoiceInput>;
  voiceError: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

const MAX_TEXTAREA_PX = 132;

export function Composer(p: ComposerProps) {
  const { s, voice } = p;
  const ta = p.textareaRef;

  // Automatic resizing: grow with content up to ~5 lines, then scroll.
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_PX) + 'px';
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_PX ? 'auto' : 'hidden';
  }, [p.text, ta, voice.state]);

  const recording = voice.state === 'recording';
  const transcribing = voice.state === 'transcribing';
  const canSend = !p.busy && !p.disabled && voice.state === 'idle' && (!!p.text.trim() || p.attachments.length > 0);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) p.onSend();
    }
  };
  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (files.length) {
      e.preventDefault();
      p.onAddFiles(files);
    }
  };
  const onDrop = (e: DragEvent) => {
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      p.onAddFiles([...e.dataTransfer.files]);
    }
  };

  return (
    <div className="sai-composer" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      {p.attachments.length > 0 && (
        <ul className="sai-tray" aria-label={s.attachments} data-testid="attachment-tray">
          {p.attachments.map((a) => (
            <li key={a.id} className="sai-att-chip" data-kind={a.kind} data-testid="attachment-chip">
              {a.previewUrl ? <img src={a.previewUrl} alt="" /> : <IconFile />}
              <span dir="auto">{a.file.name}</span>
              <small>{formatBytes(a.file.size)}</small>
              <button type="button" className="sai-chip-x" aria-label={`${s.removeAttachment}: ${a.file.name}`} onClick={() => p.onRemoveAttachment(a.id)} data-testid="attachment-remove">
                <IconX />
              </button>
            </li>
          ))}
        </ul>
      )}
      {p.attachmentProblem && <p className="sai-inline-err" role="alert" data-testid="attachment-problem">{p.attachmentProblem}</p>}
      {voice.error && (
        <p className="sai-inline-err" role="alert" data-testid="voice-error">
          {p.voiceError}
          {voice.error === 'permission_denied' && <> {s.micPermissionHelp}</>}
        </p>
      )}

      <div className="sai-row-input">
        <input
          ref={p.fileInputRef}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          data-testid="file-input"
          onChange={(e) => {
            p.onAddFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <button type="button" className="sai-icon-btn" aria-label={s.attach} title={s.attach} onClick={() => p.fileInputRef.current?.click()} disabled={recording || transcribing || p.attachments.length >= ASSISTANT_LIMITS.maxAttachmentsPerMessage} data-testid="attach-btn">
          <IconClip />
        </button>

        {recording || transcribing ? (
          <div className="sai-recbar" role="status" data-testid="recording-bar">
            {recording ? (
              <>
                <span className="sai-rec-dot" aria-hidden="true" />
                <span className="sai-rec-label">{s.recording}</span>
                <time className="sai-rec-time" data-testid="rec-time">{formatDuration(voice.seconds)}</time>
                {voice.interim && <span className="sai-rec-interim" dir="auto">{voice.interim}</span>}
              </>
            ) : (
              <>
                <IconSpinner className="sai-spin-icon" />
                <span className="sai-rec-label">{s.transcribing}</span>
              </>
            )}
          </div>
        ) : (
          <textarea
            ref={p.textareaRef}
            className="sai-textarea"
            rows={1}
            dir="auto"
            value={p.text}
            maxLength={ASSISTANT_LIMITS.maxTextLength}
            placeholder={s.placeholder}
            aria-label={s.composerLabel}
            onChange={(e) => p.onText(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            disabled={p.disabled}
            data-testid="composer-input"
          />
        )}

        {recording ? (
          <>
            <button type="button" className="sai-icon-btn" aria-label={s.micCancel} title={s.micCancel} onClick={voice.cancel} data-testid="mic-cancel"><IconX /></button>
            <button type="button" className="sai-send" aria-label={s.micStop} title={s.micStop} onClick={voice.stop} data-testid="mic-stop"><IconCheck /></button>
          </>
        ) : transcribing ? (
          <button type="button" className="sai-icon-btn" aria-label={s.micCancel} title={s.micCancel} onClick={voice.cancel} data-testid="mic-cancel"><IconX /></button>
        ) : (
          <>
            {voice.supported && !p.busy && (
              <button type="button" className="sai-icon-btn" aria-label={s.mic} title={s.mic} onClick={voice.start} disabled={p.disabled} data-testid="mic-btn"><IconMic /></button>
            )}
            {p.busy ? (
              <button type="button" className="sai-send sai-stop" aria-label={s.stop} title={s.stop} onClick={p.onStop} data-testid="stop-btn"><IconStop /></button>
            ) : (
              <button type="button" className="sai-send" aria-label={s.send} title={s.send} onClick={p.onSend} disabled={!canSend} data-testid="send-btn"><IconSend className="sai-flip-rtl" /></button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
