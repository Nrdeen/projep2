import { Award, BadgeCheck, FileCheck2, PhoneCall, Plus, ShieldCheck } from 'lucide-react';

interface ListingsShowcaseBannerProps {
  onAddListing?: () => void;
  isEn?: boolean;
}

export function ListingsShowcaseBanner({
  onAddListing,
  isEn = false,
}: ListingsShowcaseBannerProps) {
  const trustItems = [
    {
      key: 'wafy',
      label: isEn ? 'Secure Payment with Wafy' : 'دفع آمن مع وفي',
      Icon: ShieldCheck,
      iconClass: 'text-amber-600 dark:text-[#F4C569]',
    },
    {
      key: 'direct',
      label: isEn ? 'Direct Seller Contact' : 'تواصل مباشر مع البائع',
      Icon: PhoneCall,
      iconClass: 'text-[var(--color-green)] dark:text-emerald-400',
    },
    {
      key: 'contracts',
      label: isEn ? 'Verified Contracts' : 'عقود موثقة',
      Icon: FileCheck2,
      iconClass: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      key: 'tabby',
      label: isEn ? 'Installments with Tabby' : 'قسط مع تابي',
      Icon: BadgeCheck,
      iconClass: 'text-[var(--color-green-ink)] dark:text-[#F4C569]',
    },
  ];

  return (
    <section
      aria-label={isEn ? 'Mirbah Showcase' : 'بوابة مِرباح للأنعام ومستلزماتها'}
      className="w-full"
    >
      <div className="rounded-[28px] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[0_14px_38px_rgba(16,60,44,0.08)] dark:shadow-[0_16px_42px_rgba(0,0,0,0.38)] overflow-hidden">
        {/* Top Split Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
          {/* Visual / Livestock Photo Side */}
          <div className="md:col-span-6 relative min-h-[190px] sm:min-h-[230px] md:min-h-[260px] overflow-hidden bg-[var(--color-cream)]">
            <img
              src="/assets/aistudio/banner_ff14681c.webp"
              alt={isEn ? 'Livestock and pastures in Saudi Arabia' : 'أنعام ومواشي في مِرباح'}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover object-[52%_35%] scale-105 sm:scale-110"
              loading="eager"
            />
            {/* Mobile Vertical Blend */}
            <div
              aria-hidden="true"
              className="md:hidden absolute inset-0 z-10 pointer-events-none"
              style={{
                background:
                  'linear-gradient(to top, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 22%, transparent) 44%, transparent 78%)',
              }}
            />
            {/* Desktop Horizontal Edge Blend into Content Panel */}
            <div
              aria-hidden="true"
              className="hidden md:block absolute inset-0 z-10 pointer-events-none"
              style={{
                background: isEn
                  ? 'linear-gradient(to left, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 18%, transparent) 42%, transparent 72%)'
                  : 'linear-gradient(to right, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 18%, transparent) 42%, transparent 72%)',
              }}
            />
          </div>

          {/* Content & CTA Side */}
          <div className="md:col-span-6 relative z-20 flex flex-col items-center justify-center text-center px-6 py-6 sm:py-8">
            <div className="mb-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[var(--color-cream)] border border-[var(--color-border)]">
              <Award
                size={15}
                className="text-[var(--color-green)] dark:text-[#F4C569]"
                aria-hidden="true"
              />
              <span className="text-[11px] font-extrabold tracking-wide text-[var(--color-green-ink)] dark:text-[#F4C569]">
                {isEn ? 'Trusted Livestock Platform' : 'منصة مِرباح الموثوقة'}
              </span>
            </div>

            <h2 className="font-display text-2xl sm:text-4xl font-black text-[var(--color-ink)] tracking-tight mb-2">
              {isEn ? 'Mirbah' : 'مِرباح'}
            </h2>

            <p className="text-xs sm:text-sm font-medium text-[var(--color-muted)] max-w-md leading-relaxed mb-5">
              {isEn
                ? 'An intermediary platform connecting buyers and sellers for livestock and supplies trading'
                : 'منصة وسيطة تجمع البائع والمشتري لبيع وشراء الأنعام ومستلزماتها'}
            </p>

            {onAddListing && (
              <button
                type="button"
                onClick={onAddListing}
                className="inline-flex min-h-[44px] items-center gap-2.5 px-5 py-2.5 rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white font-extrabold text-sm border border-[var(--color-border)] shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="w-6 h-6 rounded-full bg-[#F4C569] text-[#0B231A] flex items-center justify-center shrink-0">
                  <Plus size={15} strokeWidth={2.75} aria-hidden="true" />
                </span>
                <span>{isEn ? 'Post Your Listing' : 'أضف إعلانك'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4-Column Trust Footer Bar */}
        <div className="border-t border-[var(--color-border)] bg-[var(--color-cream)]/65 px-3 sm:px-5 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 sm:gap-y-0 text-center items-center">
            {trustItems.map(({ key, label, Icon, iconClass }) => (
              <div
                key={key}
                className="flex flex-col items-center justify-center gap-1.5 px-2 py-1 sm:border-e sm:last:border-e-0 border-[var(--color-border)]"
              >
                <Icon size={20} className={iconClass} aria-hidden="true" />
                <span className="text-[11px] sm:text-xs font-bold text-[var(--color-ink)] leading-snug">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
