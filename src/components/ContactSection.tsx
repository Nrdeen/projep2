import { useState } from 'react';
import {
  ArrowUpLeft,
  ArrowUpRight,
  CheckCircle2,
  HelpCircle,
  LifeBuoy,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  INQUIRY_CATEGORY_KEYS,
  type InquiryCategoryKey,
  useI18n,
} from '../lib/i18n';
import { SAUDI_REGIONS_13 } from '../lib/marketplace-tools';
import type { PageView } from '../lib/router';

interface ContactSectionProps {
  onNavigate?: (page: PageView, options?: { hash?: string }) => void;
  onNotify: (msg: string) => void;
  embedded?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const OFFICIAL_PHONE_DISPLAY = '+966 56 441 9966';
const OFFICIAL_PHONE_HREF = 'tel:+966564419966';
const OFFICIAL_WHATSAPP_HREF = 'https://wa.me/966564419966';
const OFFICIAL_EMAIL = 'kkfjahdali@icloud.com';
const OFFICIAL_EMAIL_HREF = 'mailto:kkfjahdali@icloud.com';
const SAUDI_MAP_LINK =
  'https://www.google.com/maps/search/?api=1&query=Saudi+Arabia';
const SAUDI_MAP_EMBED =
  'https://maps.google.com/maps?q=Saudi+Arabia&t=&z=5&ie=UTF8&iwloc=&output=embed';

export function ContactSection({
  onNavigate,
  onNotify,
  embedded = false,
}: ContactSectionProps) {
  const { dir, isEn, t } = useI18n();
  const DirArrow = dir === 'rtl' ? ArrowUpLeft : ArrowUpRight;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [categoryKey, setCategoryKey] = useState<InquiryCategoryKey>('general');
  const [region, setRegion] = useState<string>('');
  const [message, setMessage] = useState('');
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedSummary, setSubmittedSummary] = useState<{
    referenceId: string;
    categoryLabel: string;
    email: string;
  } | null>(null);

  const selectedCategoryLabel = t.contactCategories[categoryKey];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2) {
      setError(t.contactErrName);
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(t.contactErrEmail);
      return;
    }
    if (trimmedMessage.length < 8) {
      setError(t.contactErrMessage);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitContactMessage({
        name: trimmedName,
        email: trimmedEmail,
        contact: trimmedEmail,
        category: selectedCategoryLabel,
        topic: selectedCategoryLabel,
        region: region || undefined,
        preferredReply: 'email',
        message: trimmedMessage,
        website: websiteHoneypot,
      });
      setSubmittedSummary({
        referenceId: res.referenceId,
        categoryLabel: selectedCategoryLabel,
        email: trimmedEmail,
      });
      setName('');
      setEmail('');
      setRegion('');
      setMessage('');
      setWebsiteHoneypot('');
      onNotify(`${t.contactSuccessTitle} (${res.referenceId})`);
    } catch (err: any) {
      setError(err?.message || t.contactErrGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="contact-section"
      dir={dir}
      className={`${
        embedded
          ? 'bg-[var(--color-canvas)] border-t border-[var(--color-border)]'
          : 'bg-[var(--color-canvas)]'
      } transition-colors`}
    >
      {/* Editorial Header Band (Matches Celebim /iletisim structure, adapted to Souq Al-Ghanam Emerald & Gold) */}
      {!embedded && (
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8">
            <p className="mb-4 text-xs font-extrabold tracking-wide text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]">
              {isEn ? 'Mirbah Contact' : 'تواصل مع مِرباح'}
            </p>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-end lg:gap-20">
              <h1 className="max-w-xl font-display text-4xl font-black leading-tight tracking-tight text-[var(--color-ink)] sm:text-5xl text-balance">
                {isEn
                  ? 'We are here for your questions.'
                  : 'نحن هنا للإجابة على استفساراتكم.'}
              </h1>
              <p className="max-w-lg text-[16px] leading-8 text-[var(--color-muted)]">
                {isEn
                  ? 'Reach out regarding membership, livestock listings, verification, or partnerships. Choose a direct channel or send your message via the form below.'
                  : 'يمكنكم التواصل معنا بخصوص العضوية أو الإعلانات أو خدمات المنصة والشراكات. اختر قناة التواصل المناسبة أو أرسل رسالتك مباشرة عبر النموذج.'}
              </p>
            </div>
          </div>
        </header>
      )}

      {/* Main 2-Column Section */}
      <section
        aria-labelledby="contact-section-heading"
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          {/* Column 1: Direct Contact Channels + Quick Channels + Support Callout */}
          <div>
            <h2
              id="contact-section-heading"
              className="font-display text-[26px] font-black tracking-tight text-[var(--color-ink)] sm:text-[30px]"
            >
              {isEn ? 'Reach us directly' : 'تواصل مباشر'}
            </h2>
            <p className="mt-3 max-w-md text-[14px] leading-7 text-[var(--color-muted)]">
              {isEn
                ? 'Contact our team through the official channels below, or submit a tracked inquiry to receive a reference number.'
                : 'يمكنكم التواصل معنا عبر قنوات الاتصال التالية، أو إرسال رسالة موثقة للحصول على رقم متابعة مرجعي فوري.'}
            </p>

            {/* Hairline-Divided Contact Channel List */}
            <div className="mt-8 border-t border-[var(--color-border)]">
              {/* Row 1: Phone */}
              <div className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-[var(--color-border)] py-5">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-cream)] text-[var(--color-green-ink)]"
                >
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-xs font-bold tracking-wide text-[var(--color-muted)]">
                    {isEn ? 'Phone' : 'الهاتف'}
                  </h3>
                  <a
                    href={OFFICIAL_PHONE_HREF}
                    dir="ltr"
                    className="mt-1 inline-block text-[17px] font-bold text-[var(--color-ink)] tabular-nums transition-colors hover:text-[var(--color-green-ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)]"
                  >
                    {OFFICIAL_PHONE_DISPLAY}
                  </a>
                </div>
              </div>

              {/* Row 2: Email */}
              <div className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-[var(--color-border)] py-5">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-cream)] text-[var(--color-green-ink)]"
                >
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-xs font-bold tracking-wide text-[var(--color-muted)]">
                    {isEn ? 'Email' : 'البريد الإلكتروني'}
                  </h3>
                  <a
                    href={OFFICIAL_EMAIL_HREF}
                    dir="ltr"
                    className="mt-1 inline-block break-all text-[17px] font-bold text-[var(--color-ink)] transition-colors hover:text-[var(--color-green-ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)]"
                  >
                    {OFFICIAL_EMAIL}
                  </a>
                </div>
              </div>

              {/* Row 3: Service Coverage & WhatsApp */}
              <div className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-[var(--color-border)] py-5">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-cream)] text-[var(--color-green-ink)]"
                >
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-xs font-bold tracking-wide text-[var(--color-muted)]">
                    {isEn ? 'Coverage & Location' : 'النطاق والمقر'}
                  </h3>
                  <p className="mt-1 max-w-sm text-[15px] font-semibold leading-7 text-[var(--color-ink)]">
                    {isEn
                      ? 'Kingdom of Saudi Arabia — Covering all 13 regions'
                      : 'المملكة العربية السعودية — تغطية جميع المناطق الـ ١٣'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <a
                      href={OFFICIAL_WHATSAPP_HREF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-green-ink)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)]"
                    >
                      <span>{isEn ? 'Chat on WhatsApp' : 'مراسلة عبر واتساب'}</span>
                      <DirArrow className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <a
                      href={SAUDI_MAP_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-gold-hover)] dark:text-[var(--color-gold)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)]"
                    >
                      <span>{isEn ? 'Open map' : 'عرض الخريطة'}</span>
                      <DirArrow className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Channel Circular Buttons (Mirrors Celebim social circle row with real channels) */}
            <div className="mt-7">
              <h3 className="text-xs font-bold tracking-wide text-[var(--color-muted)]">
                {isEn ? 'Quick access channels' : 'قنوات الوصول السريع'}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={OFFICIAL_PHONE_HREF}
                  aria-label={isEn ? 'Call support directly' : 'اتصال هاتفي مباشر'}
                  title={OFFICIAL_PHONE_DISPLAY}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-green-ink)] hover:text-[var(--color-green-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={OFFICIAL_WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={isEn ? 'Message on WhatsApp' : 'التواصل عبر واتساب'}
                  title="WhatsApp"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-green-ink)] hover:text-[var(--color-green-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={OFFICIAL_EMAIL_HREF}
                  aria-label={isEn ? 'Send email directly' : 'إرسال بريد إلكتروني'}
                  title={OFFICIAL_EMAIL}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-green-ink)] hover:text-[var(--color-green-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </a>
                {onNavigate && (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavigate('help')}
                      aria-label={t.helpFaq}
                      title={t.helpFaq}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-green-ink)] hover:text-[var(--color-green-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)] cursor-pointer"
                    >
                      <HelpCircle className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('rules')}
                      aria-label={t.helpRules}
                      title={t.helpRules}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-green-ink)] hover:text-[var(--color-green-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)] cursor-pointer"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Warm Tinted Support Box (Matches Celebim LifeBuoy Callout in Cream & Gold/Green) */}
            <div className="mt-9 flex items-start gap-4 rounded-2xl border border-[var(--color-gold)]/35 bg-[var(--color-cream)] p-5 sm:p-6">
              <LifeBuoy
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-[15px] font-bold text-[var(--color-ink)]">
                  {isEn
                    ? 'Need help with an active listing or your account?'
                    : 'هل تحتاج دعماً بخصوص إعلان حالي أو حسابك؟'}
                </h3>
                <p className="mt-1 text-[13px] leading-6 text-[var(--color-muted)]">
                  {isEn
                    ? 'Visit our Help Center to browse common answers and marketplace rules, or submit your request directly using the message form.'
                    : 'يمكنك مراجعة الأسئلة الشائعة وضوابط السوق في مركز المساعدة، أو إرسال استفسارك عبر النموذج مع رقم متابعة مرجعي.'}
                </p>
                {onNavigate && (
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => onNavigate('help')}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-ink)] underline-offset-4 hover:text-[var(--color-green-ink)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)] cursor-pointer whitespace-nowrap"
                    >
                      <span>{isEn ? 'Go to Help Center' : 'الانتقال إلى مركز المساعدة'}</span>
                      <DirArrow className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('how')}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-muted)] underline-offset-4 hover:text-[var(--color-green-ink)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)] cursor-pointer whitespace-nowrap"
                    >
                      <span>{t.helpHow}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Clean Bordered Contact Form Card (Single-Elevation Celebim Card Style) */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 lg:self-start">
            {submittedSummary ? (
              <div
                role="status"
                className="rounded-xl border border-[var(--color-green-ink)]/25 bg-[var(--color-cream)]/60 p-6 sm:p-8 text-center space-y-4"
              >
                <CheckCircle2
                  size={40}
                  className="mx-auto text-[var(--color-green-ink)]"
                  aria-hidden="true"
                />
                <div className="space-y-1.5">
                  <h3 className="font-display text-xl font-extrabold text-[var(--color-ink)]">
                    {t.contactSuccessTitle}
                  </h3>
                  <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                    {t.contactSuccessBody}
                  </p>
                </div>

                <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 text-xs space-y-1.5 max-w-md mx-auto">
                  <p className="font-bold text-[var(--color-green-ink)] tabular-nums">
                    {t.contactRefLabel}: {submittedSummary.referenceId}
                  </p>
                  <p className="text-[var(--color-muted)]">
                    {submittedSummary.categoryLabel}
                  </p>
                  <p className="text-[var(--color-muted)]" dir="ltr">
                    {submittedSummary.email}
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSubmittedSummary(null)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t.contactSendAnother}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="pb-4 border-b border-[var(--color-border)]">
                  <h3 className="font-display text-xl font-black text-[var(--color-ink)]">
                    {t.contactFormTitle}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)]">
                    {t.contactFormSubtitle}
                  </p>
                </div>

                {/* Hidden Honeypot Spam Guard */}
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="contact-website-hp">Website</label>
                  <input
                    id="contact-website-hp"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={websiteHoneypot}
                    onChange={(e) => setWebsiteHoneypot(e.target.value)}
                  />
                </div>

                {/* Inquiry Category Buttons */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-[var(--color-ink)]">
                    {t.contactCategoryLabel}
                  </span>
                  <div
                    role="group"
                    aria-label={t.contactCategoryLabel}
                    className="flex flex-wrap gap-2"
                  >
                    {INQUIRY_CATEGORY_KEYS.map((key) => {
                      const active = categoryKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCategoryKey(key)}
                          className={`min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[var(--color-green)] text-white border-[var(--color-green)]'
                              : 'bg-[var(--color-canvas)] text-[var(--color-ink)] border-[var(--color-border)] hover:border-[var(--color-gold)]'
                          }`}
                        >
                          {t.contactCategories[key]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-bold text-[var(--color-ink)] mb-1.5"
                    >
                      {t.contactNameLabel}
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.contactNamePlaceholder}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-3.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/60 focus:outline-none focus:border-[var(--color-green-ink)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-bold text-[var(--color-ink)] mb-1.5"
                    >
                      {t.contactEmailLabel}
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      dir="ltr"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.contactEmailPlaceholder}
                      autoComplete="email"
                      className="w-full min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-3.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/60 focus:outline-none focus:border-[var(--color-green-ink)]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="contact-region"
                      className="block text-xs font-bold text-[var(--color-ink)] mb-1.5"
                    >
                      {t.contactRegionLabel}
                    </label>
                    <select
                      id="contact-region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-3.5 text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
                    >
                      <option value="">{t.contactAllRegions}</option>
                      {SAUDI_REGIONS_13.map((reg) => (
                        <option key={reg} value={reg}>
                          {reg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="contact-message"
                      className="block text-xs font-bold text-[var(--color-ink)]"
                    >
                      {t.contactMessageLabel}
                    </label>
                    <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
                      {message.length} / 2000
                    </span>
                  </div>
                  <textarea
                    id="contact-message"
                    rows={4}
                    maxLength={2000}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t.contactMessagePlaceholder}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/60 focus:outline-none focus:border-[var(--color-green-ink)]"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">
                    {error}
                  </p>
                )}

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {submitting ? (
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send size={15} aria-hidden="true" />
                    )}
                    <span>{submitting ? t.contactSubmitting : t.contactSubmit}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Embedded Coverage Map Card (Mirrors Celebim Map Container + Footer Caption Bar) */}
        {!embedded && (
          <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <iframe
              src={SAUDI_MAP_EMBED}
              title={
                isEn
                  ? 'Mirbah Coverage — Kingdom of Saudi Arabia'
                  : 'نطاق تغطية مِرباح — المملكة العربية السعودية'
              }
              className="h-[300px] w-full sm:h-[360px]"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="border-t border-[var(--color-border)] px-5 py-5 sm:px-6">
              <p className="text-xs font-bold tracking-wide text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]">
                {isEn ? 'Service Coverage' : 'نطاق الخدمة والتغطية'}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                {isEn
                  ? 'Kingdom of Saudi Arabia — Serving livestock breeders and buyers across all 13 Saudi regions.'
                  : 'المملكة العربية السعودية — خدمة المربين والمشترين في الرياض ومكة المكرمة والمدينة المنورة والقصيم والمنطقة الشرقية وكافة المناطق.'}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
