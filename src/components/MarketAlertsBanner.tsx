import { useEffect, useId, useState } from 'react';
import { BellRing, CheckCircle2, Mail, MessageCircle, Pencil } from 'lucide-react';
import { useI18n } from '../lib/i18n';

type AlertChannel = 'email' | 'whatsapp';

interface StoredSubscription {
  channel: AlertChannel;
  value: string;
}

interface MarketAlertsBannerProps {
  variant?: 'compact' | 'card';
  className?: string;
}

const STORAGE_KEY = 'souq-market-alerts-sub';
const SYNC_EVENT = 'souq-market-alerts-updated';

function readStoredSubscription(): StoredSubscription | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSubscription>;
    if (
      (parsed.channel === 'email' || parsed.channel === 'whatsapp') &&
      typeof parsed.value === 'string' &&
      parsed.value.trim().length > 0
    ) {
      return { channel: parsed.channel, value: parsed.value.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeSaudiWhatsApp(raw: string): string | null {
  const digits = raw.replace(/[\s\-()+]/g, '');
  if (/^05\d{8}$/.test(digits)) return digits;
  if (/^5\d{8}$/.test(digits)) return `0${digits}`;
  if (/^9665\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^009665\d{8}$/.test(digits)) return `0${digits.slice(5)}`;
  return null;
}

export function MarketAlertsBanner({
  variant = 'card',
  className = '',
}: MarketAlertsBannerProps) {
  const { dir, isEn, t } = useI18n();
  const inputId = useId();
  const [channel, setChannel] = useState<AlertChannel>('email');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [subscription, setSubscription] = useState<StoredSubscription | null>(() =>
    readStoredSubscription()
  );

  useEffect(() => {
    const syncFromStorage = () => {
      setSubscription(readStoredSubscription());
    };
    window.addEventListener(SYNC_EVENT, syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const persistSubscription = (next: StoredSubscription | null) => {
    setSubscription(next);
    try {
      if (next) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      window.dispatchEvent(new Event(SYNC_EVENT));
    } catch {
      // Ignore storage quota errors in restricted browsing modes
    }
  };

  const handleChannelChange = (nextChannel: AlertChannel) => {
    setChannel(nextChannel);
    setInputValue('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();

    if (channel === 'email') {
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError(t.footerNewsletterError);
        return;
      }
      setError('');
      persistSubscription({ channel: 'email', value: trimmed });
      setInputValue('');
      return;
    }

    const normalized = normalizeSaudiWhatsApp(trimmed);
    if (!normalized) {
      setError(
        isEn
          ? 'Please enter a valid Saudi mobile number (05XXXXXXXX).'
          : 'يرجى إدخال رقم جوال سعودي صحيح (05XXXXXXXX).'
      );
      return;
    }

    setError('');
    persistSubscription({ channel: 'whatsapp', value: normalized });
    setInputValue('');
  };

  const handleEdit = () => {
    if (!subscription) return;
    setChannel(subscription.channel);
    setInputValue(subscription.value);
    setError('');
    persistSubscription(null);
  };

  const isCompact = variant === 'compact';

  return (
    <div
      dir={dir}
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] ${
        isCompact ? 'px-3.5 py-3 sm:px-4 sm:py-3.5' : 'rounded-2xl p-5 sm:p-6'
      } transition-colors ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Heading & Description */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            aria-hidden="true"
            className={`shrink-0 rounded-xl bg-[var(--color-gold-soft)] text-[var(--color-green-ink)] border border-[var(--color-gold)]/30 grid place-items-center ${
              isCompact ? 'w-10 h-10' : 'w-11 h-11'
            }`}
          >
            <BellRing size={isCompact ? 18 : 20} />
          </div>
          <div className="min-w-0">
            <h3
              className={`font-display font-extrabold text-[var(--color-ink)] ${
                isCompact ? 'text-sm sm:text-[15px]' : 'text-base sm:text-lg'
              }`}
            >
              {t.footerNewsletterTitle}
            </h3>
            <p
              className={`mt-0.5 text-[var(--color-muted)] leading-relaxed ${
                isCompact ? 'text-xs' : 'text-xs sm:text-sm'
              }`}
            >
              {t.footerNewsletterSubtitle}
            </p>
          </div>
        </div>

        {/* Subscription State or Form */}
        {subscription ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between sm:justify-end gap-3 rounded-xl border border-[var(--color-gold)]/45 bg-[var(--color-gold-soft)]/60 px-4 py-2.5"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--color-green-ink)]">
              <CheckCircle2 size={17} className="shrink-0" aria-hidden="true" />
              <span>{t.footerNewsletterSuccess}</span>
              <span
                dir="ltr"
                className="font-mono text-xs font-extrabold text-[var(--color-ink)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2 py-0.5 tabular-nums"
              >
                {subscription.value}
              </span>
            </div>
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-gold)] text-xs font-bold text-[var(--color-ink)] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Pencil size={13} aria-hidden="true" />
              <span>{isEn ? 'Change' : 'تعديل'}</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-start gap-2.5 shrink-0"
          >
            {/* Channel Segmented Switch */}
            <div
              role="group"
              aria-label={isEn ? 'Alert channel' : 'قناة التنبيه'}
              className="inline-flex h-11 p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)] shrink-0"
            >
              <button
                type="button"
                onClick={() => handleChannelChange('email')}
                aria-pressed={channel === 'email'}
                className={`inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  channel === 'email'
                    ? 'bg-[var(--color-surface)] text-[var(--color-green-ink)] shadow-xs border border-[var(--color-border)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                <Mail size={14} aria-hidden="true" />
                <span>{isEn ? 'Email' : 'البريد'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleChannelChange('whatsapp')}
                aria-pressed={channel === 'whatsapp'}
                className={`inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  channel === 'whatsapp'
                    ? 'bg-[var(--color-surface)] text-[var(--color-green-ink)] shadow-xs border border-[var(--color-border)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                <MessageCircle size={14} aria-hidden="true" />
                <span>{isEn ? 'WhatsApp' : 'واتساب'}</span>
              </button>
            </div>

            {/* Input + Error */}
            <div className="flex flex-col gap-1 min-w-0 sm:w-64">
              <label
                htmlFor={inputId}
                className="flex items-center gap-2 h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-3.5 focus-within:border-[var(--color-gold)] focus-within:ring-2 focus-within:ring-[var(--color-gold)]/20 transition-colors"
              >
                {channel === 'email' ? (
                  <Mail size={16} className="text-[var(--color-muted)] shrink-0" aria-hidden="true" />
                ) : (
                  <MessageCircle
                    size={16}
                    className="text-[var(--color-muted)] shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span className="sr-only">{t.footerNewsletterTitle}</span>
                <input
                  id={inputId}
                  type={channel === 'email' ? 'email' : 'tel'}
                  inputMode={channel === 'email' ? 'email' : 'tel'}
                  dir="ltr"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (error) setError('');
                  }}
                  aria-invalid={error ? 'true' : undefined}
                  placeholder={
                    channel === 'email'
                      ? t.footerNewsletterPlaceholder
                      : isEn
                        ? '05XXXXXXXX'
                        : '05XXXXXXXX (رقم الواتساب)'
                  }
                  autoComplete={channel === 'email' ? 'email' : 'tel'}
                  className="w-full min-w-0 bg-transparent border-0 outline-none text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] text-start"
                />
              </label>
              {error && (
                <span
                  role="alert"
                  className="text-xs font-semibold text-rose-700 dark:text-rose-300 px-1"
                >
                  {error}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="h-11 px-5 rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
            >
              {t.footerNewsletterCta}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
