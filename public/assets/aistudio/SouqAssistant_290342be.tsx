import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { ListingSummary, Locale, PageContext } from '../../shared/types';
import { AssistantClient, type AssistantClientOptions } from '../api/assistantClient';
import { useAssistant } from '../hooks/useAssistant';
import { useAttachments } from '../hooks/useAttachments';
import { useTts } from '../hooks/useTts';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type { VoiceMode, VoiceErrorCode } from '../services/speechToText';
import { strings } from '../utils/i18n';
import { Composer } from './Composer';
import { HistoryDrawer } from './HistoryDrawer';
import { IconGlobe, IconHistory, IconMoon, IconPlus, IconSparkle, IconSun, IconX, IconAlert } from './Icons';
import { MessageList } from './MessageList';
import { WelcomeScreen, type QuickAction } from './WelcomeScreen';

export type ThemePref = 'light' | 'dark' | 'system';

export interface SouqAssistantProps {
  /** Where the host mounted the assistant routes, e.g. "/api/ai-assistant". */
  apiBaseUrl: string;
  getHeaders?: AssistantClientOptions['getHeaders'];
  credentials?: RequestCredentials;
  /** Provide your own client (tests / custom fetch). */
  client?: AssistantClient;

  /** Controlled or default locale. The host's language setting should win. */
  locale?: Locale;
  defaultLocale?: Locale;
  onLocaleChange?: (l: Locale) => void;
  theme?: ThemePref;
  defaultTheme?: ThemePref;
  onThemeChange?: (t: 'light' | 'dark') => void;
  showLocaleToggle?: boolean;
  showThemeToggle?: boolean;

  /** What page the user is on; the server treats it as untrusted data. */
  pageContext?: PageContext;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pass the site's EXISTING assistant icon here to preserve it. */
  launcherIcon?: ReactNode;
  hideLauncher?: boolean;
  /** "floating" = launcher + popup panel; "embedded" = fills its container. */
  mode?: 'floating' | 'embedded';

  voiceMode?: VoiceMode;
  /** Called when a listing card is clicked; call ev.preventDefault() for SPA navigation. */
  onOpenListing?: (l: ListingSummary, ev: MouseEvent<HTMLAnchorElement>) => void;
  storageKeyPrefix?: string;
}

function safeGet(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return dark;
}

const VOICE_ERR_KEY: Record<VoiceErrorCode, 'micDenied' | 'micNoDevice' | 'micUnsupported' | 'micNoSpeech' | 'micFailed'> = {
  permission_denied: 'micDenied',
  no_device: 'micNoDevice',
  unsupported: 'micUnsupported',
  no_speech: 'micNoSpeech',
  failed: 'micFailed',
};

export function SouqAssistant(props: SouqAssistantProps) {
  const prefix = props.storageKeyPrefix ?? 'souq-ai';
  const mode = props.mode ?? 'floating';

  // ---- locale / theme (controlled if the host passes them, otherwise remembered per browser)
  const [localeState, setLocaleState] = useState<Locale>(() => (safeGet(`${prefix}:locale`) as Locale | null) ?? props.defaultLocale ?? 'ar');
  const locale = props.locale ?? localeState;
  const [themeState, setThemeState] = useState<ThemePref>(() => (safeGet(`${prefix}:theme`) as ThemePref | null) ?? props.defaultTheme ?? 'system');
  const themePref = props.theme ?? themeState;
  const systemDark = useSystemDark();
  const theme: 'light' | 'dark' = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;
  const s = strings(locale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const toggleLocale = () => {
    const next: Locale = locale === 'ar' ? 'en' : 'ar';
    setLocaleState(next);
    safeSet(`${prefix}:locale`, next);
    props.onLocaleChange?.(next);
  };
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    safeSet(`${prefix}:theme`, next);
    props.onThemeChange?.(next);
  };

  // ---- open state
  const [openState, setOpenState] = useState(props.defaultOpen ?? mode === 'embedded');
  const open = mode === 'embedded' ? true : props.open ?? openState;
  const setOpen = useCallback(
    (v: boolean) => {
      setOpenState(v);
      props.onOpenChange?.(v);
    },
    [props],
  );
  const everOpened = useRef(false);
  if (open) everOpened.current = true;

  // ---- services
  const client = useMemo(
    () => props.client ?? new AssistantClient({ baseUrl: props.apiBaseUrl, getHeaders: props.getHeaders, credentials: props.credentials }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.client, props.apiBaseUrl],
  );
  const a = useAssistant({ client, locale, pageContext: props.pageContext, enabled: everOpened.current, storageKey: `${prefix}:active-conversation` });
  const atts = useAttachments();
  const tts = useTts(locale);
  const [text, setText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const voice = useVoiceInput({
    client,
    locale,
    mode: props.voiceMode,
    onText: (t) => {
      setText((prev) => (prev.trim() ? prev.replace(/\s*$/, ' ') : '') + t);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
  });

  const attachProblemText = atts.problem
    ? { type: s.fileType, size: s.fileSize, count: s.fileCount, empty: s.fileEmpty }[atts.problem]
    : null;
  const voiceErrorText = voice.error ? s[VOICE_ERR_KEY[voice.error]] : null;

  const submit = useCallback(async () => {
    const ok = await a.send(text, atts.items);
    if (ok) {
      setText('');
      atts.clear();
    }
  }, [a, atts, text]);

  const onQuickAction = (id: QuickAction) => {
    if (id === 'photo') {
      if (!text.trim()) setText(s.qaPhotoPrompt);
      fileInputRef.current?.click();
      return;
    }
    const prompt = { search: s.qaSearchPrompt, compare: s.qaComparePrompt, ad: s.qaAdPrompt }[id];
    void a.send(prompt, []);
  };

  const newChat = () => {
    a.newConversation();
    setText('');
    atts.clear();
    tts.stop();
    setShowHistory(false);
    textareaRef.current?.focus();
  };

  // Focus the composer when the panel opens.
  useEffect(() => {
    if (open) requestAnimationFrame(() => textareaRef.current?.focus());
  }, [open]);

  // Escape: close history first, then the panel (never while recording).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || voice.state !== 'idle') return;
      if (showHistory) setShowHistory(false);
      else if (mode === 'floating') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, showHistory, voice.state, mode, setOpen]);

  // Full-screen sheet on phones: prevent the page behind from scrolling.
  useEffect(() => {
    if (!open || mode !== 'floating' || !window.matchMedia?.('(max-width: 640px)').matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, mode]);

  const icon = props.launcherIcon ?? <IconSparkle />;
  const showWelcome = a.messages.length === 0 && !a.loadingConversation;
  const err = a.error;
  const errText = err ? s.errors[err.code] ?? s.errors.internal : null;

  return (
    <div className="souq-ai" data-theme={theme} data-mode={mode} data-open={open} dir={dir} lang={locale}>
      {mode === 'floating' && !open && !props.hideLauncher && (
        <button type="button" className="sai-launcher" aria-label={s.open} title={s.open} onClick={() => setOpen(true)} data-testid="launcher">
          <span className="sai-launcher-icon">{icon}</span>
        </button>
      )}

      {open && (
        <section className="sai-panel" role="dialog" aria-label={s.title} ref={panelRef} data-testid="panel">
          <header className="sai-header">
            <span className="sai-header-icon" aria-hidden="true">{icon}</span>
            <div className="sai-header-text">
              <strong>{s.title}</strong>
              <small>{s.subtitle}</small>
            </div>
            <span className="sai-spacer" />
            <button type="button" className="sai-hbtn" aria-label={s.history} title={s.history} aria-pressed={showHistory} onClick={() => { setShowHistory((v) => !v); void a.refreshList(); }} data-testid="history-btn"><IconHistory /></button>
            <button type="button" className="sai-hbtn" aria-label={s.newChat} title={s.newChat} onClick={newChat} data-testid="new-chat-btn"><IconPlus /></button>
            {(props.showLocaleToggle ?? true) && (
              <button type="button" className="sai-hbtn sai-hbtn-text" aria-label={s.langToggle} title={s.langToggle} onClick={toggleLocale} data-testid="lang-btn"><IconGlobe /><span aria-hidden="true">{s.langShort}</span></button>
            )}
            {(props.showThemeToggle ?? true) && (
              <button type="button" className="sai-hbtn" aria-label={theme === 'dark' ? s.themeToLight : s.themeToDark} title={theme === 'dark' ? s.themeToLight : s.themeToDark} onClick={toggleTheme} data-testid="theme-btn">
                {theme === 'dark' ? <IconSun /> : <IconMoon />}
              </button>
            )}
            {mode === 'floating' && (
              <button type="button" className="sai-hbtn" aria-label={s.close} title={s.close} onClick={() => setOpen(false)} data-testid="close-btn"><IconX /></button>
            )}
          </header>

          <div className="sai-body">
            {a.loadingConversation ? (
              <p className="sai-empty" role="status">{s.loading}</p>
            ) : showWelcome ? (
              <WelcomeScreen s={s} icon={icon} onAction={onQuickAction} disabled={a.busy} />
            ) : (
              <MessageList
                messages={a.messages}
                s={s}
                locale={locale}
                canRegenerate={a.canRegenerate}
                busy={a.busy}
                speakingId={tts.speakingId}
                ttsSupported={tts.supported}
                onRegenerate={a.regenerate}
                onFeedback={a.setFeedback}
                onSpeak={tts.toggle}
                onOpenListing={props.onOpenListing}
              />
            )}
            {showHistory && (
              <HistoryDrawer
                s={s}
                locale={locale}
                items={a.conversations}
                activeId={a.activeId}
                loading={a.historyLoading}
                onSelect={(id) => { setShowHistory(false); tts.stop(); void a.openConversation(id); }}
                onDelete={a.deleteConversation}
                onNew={newChat}
                onClose={() => setShowHistory(false)}
              />
            )}
          </div>

          <footer className="sai-footer">
            {err && (
              <div className="sai-error" role="alert" data-testid="error-banner" data-code={err.code}>
                <IconAlert />
                <span>
                  {errText}
                  {err.retryAfterSeconds ? ` ${s.retryAfter(err.retryAfterSeconds)}` : ''}
                </span>
                {a.canRetry && <button type="button" onClick={() => void a.retry()} data-testid="retry-btn">{s.retry}</button>}
                <button type="button" className="sai-error-x" aria-label={s.dismiss} onClick={a.dismissError}><IconX /></button>
              </div>
            )}
            {tts.failed && <p className="sai-inline-err" role="alert">{s.ttsUnsupported}</p>}
            <Composer
              s={s}
              text={text}
              onText={setText}
              busy={a.busy}
              attachments={atts.items}
              attachmentProblem={attachProblemText}
              onAddFiles={atts.add}
              onRemoveAttachment={atts.remove}
              onSend={() => void submit()}
              onStop={a.stop}
              voice={voice}
              voiceError={voiceErrorText}
              fileInputRef={fileInputRef}
              textareaRef={textareaRef}
            />
            <p className="sai-note">{s.aiNote}</p>
          </footer>
        </section>
      )}
    </div>
  );
}
