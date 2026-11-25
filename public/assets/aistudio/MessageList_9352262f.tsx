import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { ListingSummary, Locale } from '../../shared/types';
import type { UiMessage } from '../hooks/useAssistant';
import { parseBlocks, toPlainText, type Inline } from '../utils/markdown';
import { formatBytes } from '../utils/format';
import type { Strings } from '../utils/i18n';
import { IconCheck, IconCopy, IconFile, IconRefresh, IconSpeaker, IconStop, IconThumbDown, IconThumbUp } from './Icons';
import { ListingCard, StatsCard } from './ListingCard';

export interface MessageListProps {
  messages: UiMessage[];
  s: Strings;
  locale: Locale;
  canRegenerate: boolean;
  busy: boolean;
  speakingId: string | null;
  ttsSupported: boolean;
  onRegenerate: () => void;
  onFeedback: (id: string, value: 'up' | 'down' | null) => void;
  onSpeak: (id: string, text: string) => void;
  onOpenListing?: (l: ListingSummary, ev: MouseEvent<HTMLAnchorElement>) => void;
}

const renderInline = (parts: Inline[]) => parts.map((p, i) => (p.t === 'bold' ? <strong key={i}>{p.v}</strong> : <span key={i}>{p.v}</span>));

/** Markdown subset → React elements. No innerHTML anywhere: model output can never inject markup. */
export function RichText({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <>
      {blocks.map((b, i) =>
        b.t === 'p' ? (
          <p key={i}>{renderInline(b.inline)}</p>
        ) : b.t === 'ul' ? (
          <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>
        ) : (
          <ol key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>
        ),
      )}
    </>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyButton({ text, s }: { text: string; s: Strings }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1800);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button type="button" className="sai-act" aria-label={done ? s.copied : s.copy} title={done ? s.copied : s.copy} onClick={async () => setDone(await copyText(toPlainText(text)))} data-testid="copy-btn">
      {done ? <IconCheck /> : <IconCopy />}
    </button>
  );
}

function Attachments({ m, s }: { m: UiMessage; s: Strings }) {
  const list = m.attachments ?? [];
  if (!list.length) return null;
  return (
    <ul className="sai-msg-atts" aria-label={s.attach}>
      {list.map((a) => {
        const local = m.localAttachments?.find((x) => x.id === a.id);
        return (
          <li key={a.id} className="sai-att-chip" data-kind={a.kind}>
            {local?.previewUrl ? <img src={local.previewUrl} alt={a.name} /> : <IconFile />}
            <span dir="auto">{a.name}</span>
            <small>{formatBytes(a.sizeBytes)}</small>
          </li>
        );
      })}
    </ul>
  );
}

export function MessageList(p: MessageListProps) {
  const { messages, s, locale } = p;
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastIdx = messages.length - 1;

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });

  return (
    <div className="sai-messages" ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions" data-testid="messages">
      {messages.map((m, i) => {
        const isLastAssistant = m.role === 'assistant' && i === lastIdx;
        if (m.role === 'user') {
          return (
            <div key={m.id} className="sai-row sai-row-user" data-testid="msg-user">
              <div className="sai-bubble sai-bubble-user" dir="auto">
                <Attachments m={m} s={s} />
                {m.text && <p>{m.text}</p>}
              </div>
            </div>
          );
        }
        const empty = !m.text && !m.listings?.length;
        return (
          <div key={m.id} className="sai-row sai-row-ai" data-testid="msg-assistant">
            <div className="sai-bubble sai-bubble-ai" dir="auto">
              {m.streaming && empty ? (
                <span className="sai-typing" role="status" aria-label="…"><i /><i /><i /></span>
              ) : (
                <RichText text={m.text} />
              )}
              {m.interrupted && <em className="sai-interrupted">{s.interrupted}</em>}
            </div>
            {m.stats && <StatsCard stats={m.stats} s={s} locale={locale} />}
            {!!m.listings?.length && (
              <div className="sai-cards" data-testid="listing-cards">
                {m.listings.map((l) => <ListingCard key={l.id} listing={l} s={s} locale={locale} onOpen={p.onOpenListing} />)}
              </div>
            )}
            {!m.streaming && !empty && (
              <div className="sai-actions" role="group">
                {m.text && <CopyButton text={m.text} s={s} />}
                {m.text && p.ttsSupported && (
                  <button type="button" className="sai-act" aria-pressed={p.speakingId === m.id} aria-label={p.speakingId === m.id ? s.speakStop : s.speak} title={p.speakingId === m.id ? s.speakStop : s.speak} onClick={() => p.onSpeak(m.id, m.text)} data-testid="speak-btn">
                    {p.speakingId === m.id ? <IconStop /> : <IconSpeaker />}
                  </button>
                )}
                {isLastAssistant && p.canRegenerate && (
                  <button type="button" className="sai-act" aria-label={s.regenerate} title={s.regenerate} onClick={p.onRegenerate} disabled={p.busy} data-testid="regen-btn">
                    <IconRefresh />
                  </button>
                )}
                {!/^local-/.test(m.id) && (
                  <>
                    <button type="button" className="sai-act" aria-pressed={m.feedback === 'up'} aria-label={s.good} title={s.good} onClick={() => p.onFeedback(m.id, m.feedback === 'up' ? null : 'up')} data-testid="fb-up">
                      <IconThumbUp />
                    </button>
                    <button type="button" className="sai-act" aria-pressed={m.feedback === 'down'} aria-label={s.bad} title={s.bad} onClick={() => p.onFeedback(m.id, m.feedback === 'down' ? null : 'down')} data-testid="fb-down">
                      <IconThumbDown />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
