import { useState } from 'react';
import {
  ArrowLeft,
  BadgePercent,
  Bell,
  Camera,
  Check,
  ChevronDown,
  FileText,
  Rocket,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import type { CommissionSettings } from '../lib/commission';
import { formatPriceSar } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { PageView } from '../lib/router';
import { Modal } from './Modal';

interface PricingViewProps {
  isSignedIn: boolean;
  commissionSettings?: CommissionSettings | null;
  onNavigate: (page: PageView) => void;
  onNotify: (msg: string) => void;
}

type BillingCycle = 'monthly' | 'annual';

interface SelectedPlanInfo {
  id: 'pro' | 'max' | 'boost-3' | 'boost-7';
  title: string;
  priceSar: number;
  billingNote: string;
}

export function PricingView({
  isSignedIn,
  commissionSettings,
  onNavigate,
  onNotify,
}: PricingViewProps) {
  const { dir, isEn } = useI18n();
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlanInfo | null>(null);
  const [requestNote, setRequestNote] = useState('');

  const proPrice = billing === 'monthly' ? 99 : 79;
  const maxPrice = billing === 'monthly' ? 299 : 239;
  const boost7Price = commissionSettings?.featuredWeeklyPriceSar ?? 35;
  const boost3Price = Math.max(15, Math.round(boost7Price * 0.6));
  const periodShort = isEn
    ? billing === 'monthly'
      ? '/mo'
      : '/mo · billed annually'
    : billing === 'monthly'
      ? '/ شهرياً'
      : '/ شهرياً · يدفع سنوياً';

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirmPlanRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenTitle = selectedPlan?.title || (isEn ? 'Selected Plan' : 'الباقة المختارة');
    setSelectedPlan(null);
    setRequestNote('');
    onNotify(
      isEn
        ? `Your request for ${chosenTitle} has been recorded. Continue from your account.`
        : `تم تسجيل طلبك لـ ${chosenTitle}. يمكنك المتابعة وتفعيل الطلب من حسابك.`
    );
    onNavigate(isSignedIn ? 'dashboard' : 'login');
  };

  const plans = [
    {
      id: 'start' as const,
      name: isEn ? 'Start Plan' : 'باقة البداية',
      popular: false,
      priceDisplay: isEn ? 'Free' : 'مجاناً',
      priceNumber: 0,
      coreFeatures: isEn
        ? [
            'Up to 3 active listings',
            'Listing duration: 30 days',
            'Up to 5 photos per listing',
            'Standard search ranking',
            'Attach health & vaccination certificates',
          ]
        : [
            'حتى 3 إعلانات نشطة في نفس الوقت',
            'مدة الإعلان: 30 يوماً',
            'حتى 5 صور لكل إعلان',
            'ترتيب قياسي في نتائج البحث',
            'إرفاق الشهادات والتقارير الصحية',
          ],
      extraFeatures: isEn
        ? [
            'Direct buyer & breeder messaging',
            'Basic listing views counter',
            'Instant Saudi region & breed categorization',
          ]
        : [
            'محادثات مباشرة مع المشترين والمربين',
            'عداد أساسي لمشاهدات كل إعلان',
            'تصنيف تلقائي حسب المنطقة والسلالة',
          ],
      ctaLabel: isEn ? 'Sign Up / Sign In' : isSignedIn ? 'أضف إعلانك مجاناً' : 'سجّل أو ادخل',
    },
    {
      id: 'pro' as const,
      name: isEn ? 'Pro Plan' : 'باقة برو',
      popular: true,
      priceDisplay: `${proPrice}`,
      priceNumber: proPrice,
      coreFeatures: isEn
        ? [
            'Up to 12 active listings',
            'Listing duration: 45 days',
            'Up to 10 photos per listing',
            '1 video · 30 sec · 25 MB',
            '1.5x priority boost in search results',
          ]
        : [
            'حتى 12 إعلاناً نشطاً',
            'مدة الإعلان: 45 يوماً',
            'حتى 10 صور لكل إعلان',
            'فيديو واحد · 30 ثانية · 25 ميجا',
            'أولوية ظهور 1.5x في نتائج البحث',
          ],
      extraFeatures: isEn
        ? [
            'Monthly free 3-day listing boost credit',
            'Detailed views & contact click analytics',
            'Priority listing moderation review',
            'Custom farm profile showcase',
            'Smart price alert notifications',
            'Dedicated WhatsApp & support queue',
          ]
        : [
            'رصيد شهري مجاني لتمييز إعلان لمدة 3 أيام',
            'تحليلات تفصيلية للمشاهدات وطلبات التواصل',
            'أولوية في مراجعة ونشر الإعلانات',
            'إبراز صفحة المراح وبيانات المربي',
            'تنبيهات ذكية للأسعار والعروض المماثلة',
            'أولوية في الدعم الفني والمتابعة',
          ],
      ctaLabel: isEn ? 'Choose Pro Plan' : isSignedIn ? 'اطلب باقة برو' : 'سجّل أو ادخل',
    },
    {
      id: 'max' as const,
      name: isEn ? 'Max Plan' : 'باقة ماكس',
      popular: false,
      priceDisplay: `${maxPrice}`,
      priceNumber: maxPrice,
      coreFeatures: isEn
        ? [
            'Up to 45 active listings',
            'Listing duration: 60 days',
            'Up to 15 photos per listing',
            '2 videos · 60 sec · 50 MB',
            '2.5x priority boost in search results',
          ]
        : [
            'حتى 45 إعلاناً نشطاً',
            'مدة الإعلان: 60 يوماً',
            'حتى 15 صورة لكل إعلان',
            'فيديوهان · 60 ثانية · 50 ميجا',
            'أولوية ظهور 2.5x في نتائج البحث',
          ],
      extraFeatures: isEn
        ? [
            'Verified Farm & Breeder trust badge',
            'Multiple monthly 3-day boost credits',
            'Reusable herd & breed listing templates',
            'Scheduled automatic listing renewal',
            'Full exportable performance metrics',
            'Featured placement in Breeds directory',
            'Direct account manager onboarding',
            'Automatic image protection watermark',
            'Bulk photo & video uploader',
            '24/7 priority specialist support',
          ]
        : [
            'شارة المربي والمراح الموثق',
            'رصيد شهري مضاعف لتمييز الإعلانات 3 أيام',
            'قوالب ومسودات جاهزة لتكرار النشر السريع',
            'تجديد تلقائي مجدول للإعلانات النشطة',
            'تقارير وإحصائيات شاملة لأداء المراح',
            'ظهور مميز في دليل السلالات والمربين',
            'متابعة خاصة لإعداد وتنظيم صفحة المزرعة',
            'حماية تلقائية لصور القطيع من النسخ',
            'رفع متعدد وسريع للصور والفيديوهات',
            'دعم فني مخصص على مدار الساعة 24/7',
          ],
      ctaLabel: isEn ? 'Choose Max Plan' : isSignedIn ? 'اطلب باقة ماكس' : 'سجّل أو ادخل',
    },
  ];

  const boostPackages = [
    {
      id: 'boost-3' as const,
      title: isEn ? 'Listing Boost · 3 Days' : 'تمييز الإعلان 3 أيام',
      priceSar: boost3Price,
      desc: isEn ? '3 days of continuous spotlight' : 'تمييز وظهور متواصل لمدة 3 أيام',
    },
    {
      id: 'boost-7' as const,
      title: isEn ? 'Listing Boost · 7 Days' : 'تمييز الإعلان 7 أيام',
      priceSar: boost7Price,
      desc: isEn ? '7 days of continuous spotlight' : 'تمييز وظهور متواصل لمدة 7 أيام',
    },
  ];

  const platformFeatures = [
    {
      icon: Camera,
      title: isEn ? 'Advanced Media Management' : 'إدارة متقدمة للوسائط',
      desc: isEn
        ? 'Attach high-resolution photos and videos to your listings with automatic visual clarity and protection.'
        : 'أضف صوراً واضحة وفيديوهات توضيحية لإعلاناتك مع إبراز تفاصيل القطيع وحماية المحتوى.',
    },
    {
      icon: Bell,
      title: isEn ? 'Smart Alert System' : 'نظام تنبيهات ذكي',
      desc: isEn
        ? 'Receive instant notifications whenever new livestock matching your preferred region and breed is listed.'
        : 'استلم إشعارات فورية عند نشر إعلانات جديدة مطابقة للمنطقة والسلالة التي تبحث عنها.',
    },
    {
      icon: SlidersHorizontal,
      title: isEn ? 'Precision Search & Filtering' : 'تصفية وبحث دقيق',
      desc: isEn
        ? 'Help buyers find your livestock accurately by breed, age, weight, region, and verification status.'
        : 'يمكّن المشترين من الوصول إلى إعلاناتك بدقة حسب السلالة، العمر، الوزن، والمنطقة.',
    },
    {
      icon: FileText,
      title: isEn ? 'Listing Drafts & Templates' : 'مسودات وقوالب الإعلانات',
      desc: isEn
        ? 'Save reusable templates for the livestock breeds you trade regularly and publish future listings in seconds.'
        : 'أنشئ مسودات جاهزة للسلالات التي تبيعها باستمرار لتتمكن من نشر إعلاناتك القادمة خلال ثوانٍ.',
    },
  ];

  return (
    <div dir={dir} className="flex flex-col bg-[var(--color-canvas)] transition-colors">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-14 lg:px-12 space-y-20 sm:space-y-24">
        {/* 1. Centered Hero Header (Matches Celebim /ayricaliklarimiz) */}
        <header className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-[var(--color-ink)] text-balance">
            {isEn ? 'Our Privileges' : 'امتيازاتنا'}
          </h1>
          <p className="mt-5 text-base sm:text-lg leading-8 max-w-2xl mx-auto text-[var(--color-muted)]">
            {isEn
              ? 'Choose the package that best fits your herd or farm, and accelerate your digital livestock sales right away.'
              : 'اختر الباقة الأنسب لاحتياجاتك، وضاعف مبيعات مراحك أو مزرعتك الرقمية فوراً بأدوات احترافية.'}
          </p>
        </header>

        {/* 2. Billing Toggle + 3 Plan Cards */}
        <section aria-label={isEn ? 'Membership Plans' : 'باقات العضوية'} className="w-full flex flex-col items-center">
          {/* Monthly / Annual Pill Segmented Toggle */}
          <div
            role="tablist"
            aria-label={isEn ? 'Billing cycle' : 'دورة الفوترة'}
            className="relative inline-flex items-center p-1 bg-[var(--color-cream)] border border-[var(--color-border)] rounded-full mb-12"
          >
            <button
              type="button"
              role="tab"
              aria-selected={billing === 'monthly'}
              onClick={() => setBilling('monthly')}
              className={`relative min-w-[112px] py-2.5 px-5 text-sm font-bold rounded-full transition-all duration-200 cursor-pointer whitespace-nowrap ${
                billing === 'monthly'
                  ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {isEn ? 'Monthly' : 'شهري'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={billing === 'annual'}
              onClick={() => setBilling('annual')}
              className={`relative min-w-[156px] py-2.5 px-5 text-sm font-bold rounded-full transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                billing === 'annual'
                  ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              <span>{isEn ? 'Annual' : 'سنوي'}</span>
              <span className="text-[10px] bg-[var(--color-green)] text-white px-2 py-0.5 rounded-full font-extrabold">
                {isEn ? 'Save 20%' : 'أوفر'}
              </span>
            </button>
          </div>

          {/* 3-Column Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 w-full items-start">
            {plans.map((plan) => {
              const isExpanded = Boolean(expandedCards[plan.id]);
              return (
                <article
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl bg-[var(--color-surface)] p-7 sm:p-8 transition-all duration-200 ${
                    plan.popular
                      ? 'border-2 border-[var(--color-green-ink)] shadow-[0_18px_40px_-24px_rgba(16,60,44,0.35)]'
                      : 'border border-[var(--color-border)] shadow-sm'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute top-0 start-1/2 -translate-y-1/2 translate-x-1/2 rtl:translate-x-1/2 ltr:-translate-x-1/2 rounded-full bg-[var(--color-green)] py-1.5 px-4 text-xs font-extrabold text-white tracking-wide whitespace-nowrap shadow-xs">
                      {isEn ? 'Most Popular' : 'الأكثر طلباً'}
                    </span>
                  )}

                  <div className="flex-1 flex flex-col">
                    <h2 className="font-display text-xl font-extrabold text-[var(--color-ink)]">
                      {plan.name}
                    </h2>

                    <div className="mt-4 flex flex-col">
                      <div className="flex items-baseline gap-1.5 text-4xl font-extrabold text-[var(--color-ink)] tabular-nums">
                        {plan.priceNumber === 0 ? (
                          <span>{plan.priceDisplay}</span>
                        ) : (
                          <>
                            <span>{plan.priceDisplay}</span>
                            <span className="text-lg font-extrabold text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]">
                              {isEn ? 'SAR' : 'ر.س'}
                            </span>
                            <span className="text-[15px] font-medium text-[var(--color-muted)]">
                              {periodShort}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="h-5 mt-1">
                        {plan.priceNumber > 0 && billing === 'annual' && (
                          <p className="text-xs font-semibold text-[var(--color-green-ink)]">
                            {isEn ? '20% annual discount applied' : 'شامل خصم الاشتراك السنوي 20%'}
                          </p>
                        )}
                      </div>
                    </div>

                    <ul role="list" className="mt-6 space-y-3 flex-1">
                      {plan.coreFeatures.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-[14px]">
                          <Check
                            size={16}
                            strokeWidth={2.5}
                            className="text-[var(--color-green-ink)] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span className="text-[var(--color-ink)]/85 font-medium leading-snug">
                            {feat}
                          </span>
                        </li>
                      ))}

                      {isExpanded &&
                        plan.extraFeatures.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5 text-[14px]">
                            <Check
                              size={16}
                              strokeWidth={2.5}
                              className="text-[var(--color-gold-hover)] dark:text-[var(--color-gold)] shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span className="text-[var(--color-muted)] font-medium leading-snug">
                              {feat}
                            </span>
                          </li>
                        ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => toggleExpand(plan.id)}
                      aria-expanded={isExpanded}
                      className="mt-5 flex items-center justify-center w-full min-h-[38px] py-2 px-3 bg-[var(--color-cream)] hover:bg-[var(--color-cream-hover)] rounded-lg gap-1.5 text-xs font-bold text-[var(--color-ink)] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>
                        {isExpanded
                          ? isEn
                            ? 'Hide extra features'
                            : 'إخفاء المزايا الإضافية'
                          : isEn
                            ? `View All Features (${plan.extraFeatures.length})`
                            : `عرض جميع المزايا (${plan.extraFeatures.length})`}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (plan.id === 'start') {
                        onNavigate(isSignedIn ? 'add' : 'login');
                        return;
                      }
                      setSelectedPlan({
                        id: plan.id,
                        title: plan.name,
                        priceSar: plan.priceNumber,
                        billingNote:
                          billing === 'monthly'
                            ? isEn
                              ? 'Monthly plan'
                              : 'اشتراك شهري'
                            : isEn
                              ? 'Annual plan'
                              : 'اشتراك سنوي',
                      });
                    }}
                    className={`mt-6 w-full min-h-[46px] py-3 px-6 rounded-xl text-center font-bold text-[15px] transition-colors cursor-pointer whitespace-nowrap ${
                      plan.popular
                        ? 'bg-[var(--color-green)] text-white hover:bg-[var(--color-green-hover)]'
                        : 'bg-[var(--color-cream)] text-[var(--color-green-ink)] hover:bg-[var(--color-green)] hover:text-white'
                    }`}
                  >
                    {plan.ctaLabel}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* 3. Boost Packages Section (Matches Celebim #boost-paketleri) */}
        <section id="boost-paketleri" aria-labelledby="boost-heading" className="scroll-mt-24">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-cream)] border border-[var(--color-gold)]/35 px-3.5 py-1.5 text-xs font-bold text-[var(--color-green-ink)]">
              <Rocket size={14} className="text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]" aria-hidden="true" />
              <span>{isEn ? 'Listing Boost' : 'تمييز الإعلانات'}</span>
            </p>
            <h2
              id="boost-heading"
              className="font-display text-3xl font-extrabold tracking-tight text-[var(--color-ink)] sm:text-4xl text-balance"
            >
              {isEn ? 'Make your listing more visible' : 'اجعل إعلانك أكثر ظهوراً وانتشاراً'}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-muted)]">
              {isEn
                ? 'Boosted active listings are pinned in the featured showcase on the Listings page. Pro and Max plans also include monthly free 3-day boost credits.'
                : 'تظهر الإعلانات المميزة في القسم البارز بصفحة الإعلانات طوال مدة التمييز. كما تحصل باقتا برو وماكس على رصيد شهري مجاني للتمييز لمدة 3 أيام.'}
            </p>
          </div>

          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
            {boostPackages.map((boost) => (
              <div
                key={boost.id}
                className="relative overflow-hidden rounded-[18px] border border-[var(--color-gold)]/45 bg-[var(--color-surface)] p-6 shadow-sm"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute end-0 top-0 flex h-24 w-24 translate-x-4 ltr:translate-x-4 rtl:-translate-x-4 -translate-y-4 items-center justify-center rounded-full bg-[var(--color-cream)] text-[var(--color-green-ink)]"
                >
                  <Zap size={24} className="text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]" />
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between gap-4 pe-12">
                    <h3 className="font-display text-lg font-extrabold text-[var(--color-ink)]">
                      {boost.title}
                    </h3>
                  </div>

                  <div className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--color-green-ink)] tabular-nums">
                    {formatPriceSar(boost.priceSar)}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[14px] font-medium text-[var(--color-muted)]">
                    <Check size={15} className="text-[var(--color-green-ink)] shrink-0" aria-hidden="true" />
                    <span>{boost.desc}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPlan({
                        id: boost.id,
                        title: boost.title,
                        priceSar: boost.priceSar,
                        billingNote: isEn ? 'One-time boost credit' : 'رصيد تمييز لمرة واحدة',
                      })
                    }
                    className="mt-5 inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[var(--color-green)] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-green-hover)] cursor-pointer whitespace-nowrap"
                  >
                    {isEn ? 'Order Boost' : 'اطلب التمييز الآن'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-center gap-2 text-center">
            <p className="text-[13px] text-[var(--color-muted)]">
              {isEn
                ? 'Purchased boost credits never expire and can be applied to any active listing from your dashboard.'
                : 'رصيد التمييز لا تنتهي صلاحيته، ويمكنك تطبيقه على أي إعلان نشط من لوحة حسابك.'}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('commission')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-green-ink)] hover:underline cursor-pointer"
            >
              <BadgePercent size={14} aria-hidden="true" />
              <span>
                {isEn
                  ? `Platform sale fee: ${commissionSettings?.commissionRatePercent ?? 1}% — Open Fee Calculator`
                  : `عمولة المنصة بعد البيع: ${commissionSettings?.commissionRatePercent ?? 1}% فقط — حاسبة العمولة`}
              </span>
              <ArrowLeft size={13} className="ltr:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* 4. Bento Feature Showcase ("With Souq Al-Ghanam... All Your Needs in One Place") */}
        <section
          aria-labelledby="privileges-bento-heading"
          className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-12 lg:mx-0 lg:max-w-none lg:grid-cols-3 bg-[var(--color-cream)]/65 p-7 sm:p-10 md:p-12 rounded-[24px] border border-[var(--color-border)]"
        >
          <div>
            <p className="text-sm font-extrabold tracking-wide text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]">
              {isEn ? 'WITH MIRBAH...' : 'مع مِرباح...'}
            </p>
            <h2
              id="privileges-bento-heading"
              className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[var(--color-ink)] sm:text-4xl leading-tight text-balance"
            >
              {isEn ? (
                <>
                  All Your Needs <br />
                  In One Place
                </>
              ) : (
                <>
                  كل احتياجاتك <br />
                  في مكان واحد
                </>
              )}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--color-muted)]">
              {isEn
                ? 'Not just a marketplace — we give you every modern tool needed to grow your farm and livestock sales digitally (video uploads, smart alerts, reusable templates) in one platform.'
                : 'لسنا مجرد سوق إلكتروني فحسب، بل نوفر لك جميع الأدوات الحديثة لتنمية مبيعات مراحك رقمياً (رفع الفيديو، التنبيهات الذكية، قوالب النشر) في منصة واحدة.'}
            </p>
          </div>

          <dl className="lg:col-span-2 grid grid-cols-1 gap-x-8 gap-y-8 text-base leading-7 sm:grid-cols-2">
            {platformFeatures.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="relative flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-green-ink)]"
                  >
                    <Icon size={18} />
                  </span>
                  <div>
                    <dt className="font-display font-bold text-[var(--color-ink)] text-[15px]">
                      {item.title}
                    </dt>
                    <dd className="mt-1.5 text-[14px] text-[var(--color-muted)] leading-relaxed">
                      {item.desc}
                    </dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </section>
      </div>

      {/* Plan / Boost Inquiry Modal */}
      <Modal
        open={Boolean(selectedPlan)}
        onClose={() => setSelectedPlan(null)}
        title={selectedPlan ? (isEn ? `Request ${selectedPlan.title}` : `طلب تفعيل ${selectedPlan.title}`) : ''}
        subtitle={
          selectedPlan
            ? `${formatPriceSar(selectedPlan.priceSar)} · ${selectedPlan.billingNote}`
            : undefined
        }
      >
        {selectedPlan && (
          <form onSubmit={handleConfirmPlanRequest} className="space-y-4">
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
              {isEn
                ? 'Paid packages and boosts are activated after confirming your account from your dashboard to ensure marketplace trust.'
                : 'تُفعّل الباقات ورصيد التمييز عبر حسابك بعد تأكيد بيانات المراح لضمان موثوقية الإعلانات في السوق.'}
            </p>
            <div>
              <label
                htmlFor="plan-request-note"
                className="block text-xs font-bold text-[var(--color-ink)] mb-1.5"
              >
                {isEn ? 'Additional Notes (Optional)' : 'ملاحظات إضافية (اختياري)'}
              </label>
              <textarea
                id="plan-request-note"
                rows={3}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder={
                  isEn
                    ? 'E.g. farm name, expected monthly listings...'
                    : 'مثال: اسم المراح، عدد الرؤوس أو الإعلانات المتوقعة...'
                }
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="min-h-[42px] px-4 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
              >
                {isEn ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-sm font-bold cursor-pointer"
              >
                {isSignedIn
                  ? isEn
                    ? 'Continue to Dashboard'
                    : 'متابعة إلى لوحة حسابي'
                  : isEn
                    ? 'Sign In to Continue'
                    : 'تسجيل الدخول للمتابعة'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
