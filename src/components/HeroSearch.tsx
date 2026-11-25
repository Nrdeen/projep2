import { useMemo, useState } from 'react';
import { CheckCircle2, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import type { Breed, Category, Region } from '../types/marketplace';
import { useI18n } from '../lib/i18n';
import { trBreedName, trCategoryName, trRegionName } from '../lib/bilingual';
import { Modal } from './Modal';
import { SafeImage } from './SafeImage';

export interface QuickFilterValues {
  q: string;
  categoryId: string;
  breedId: string;
  regionId: string;
  maxPrice: string;
}

interface HeroSearchProps {
  categories: Category[];
  breeds: Breed[];
  regions: Region[];
  onSearch: (filters: QuickFilterValues) => void;
  onBrowseAll: () => void;
  onAddListing?: () => void;
  onExploreBreeds?: () => void;
  onHowItWorks?: () => void;
}

export function HeroSearch({
  categories,
  breeds,
  regions,
  onSearch,
}: HeroSearchProps) {
  const [regionId, setRegionId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [breedId, setBreedId] = useState('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { lang, isEn, dir } = useI18n();

  const mainCategories = useMemo(
    () => categories.filter((c) => c.parentId === null),
    [categories]
  );

  const availableBreeds = useMemo(() => {
    if (categoryId === 'all') return breeds;
    const matching = breeds.filter((b) => b.categoryId === categoryId);
    return matching.length > 0 ? matching : breeds;
  }, [breeds, categoryId]);

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    if (nextCategoryId !== 'all' && breedId !== 'all') {
      const matching = breeds.filter((b) => b.categoryId === nextCategoryId);
      if (matching.length > 0 && !matching.some((b) => b.id === breedId)) {
        setBreedId('all');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileFiltersOpen(false);
    onSearch({
      q: '',
      categoryId,
      breedId,
      regionId,
      maxPrice: '',
    });
  };

  const handleResetFilters = () => {
    setRegionId('all');
    setCategoryId('all');
    setBreedId('all');
  };

  const selectedRegionLabel = useMemo(() => {
    if (regionId === 'all') return isEn ? 'All Regions' : 'جميع مناطق المملكة';
    const found = regions.find((r) => r.id === regionId);
    return found ? trRegionName(found.name, lang) : isEn ? 'All Regions' : 'جميع مناطق المملكة';
  }, [regionId, regions, lang, isEn]);

  const selectedCategoryLabel = useMemo(() => {
    if (categoryId === 'all') return isEn ? 'All Types' : 'جميع الأنواع';
    const found = mainCategories.find((c) => c.id === categoryId);
    return found ? trCategoryName(found.name, lang) : isEn ? 'All Types' : 'جميع الأنواع';
  }, [categoryId, mainCategories, lang, isEn]);

  const selectedBreedLabel = useMemo(() => {
    if (breedId === 'all') return null;
    const found = breeds.find((b) => b.id === breedId);
    return found ? trBreedName(found.name, lang) : null;
  }, [breedId, breeds, lang]);

  const mobileSummaryText = [selectedRegionLabel, selectedCategoryLabel, selectedBreedLabel]
    .filter(Boolean)
    .join(' · ');

  const hasActiveFilters = regionId !== 'all' || categoryId !== 'all' || breedId !== 'all';

  return (
    <div className="bg-[var(--color-canvas)] pb-6 sm:pb-8 transition-colors">
      {/* Full-Width Hero Banner (Celebim Structure Adapted to Souq Al-Ghanam Emerald & Gold Palette) */}
      <section
        aria-label={isEn ? 'Mirbah Livestock Marketplace' : 'مِرباح - السوق الرقمي للمواشي'}
        className="relative isolate overflow-hidden bg-[#0B241A]"
      >
        <SafeImage
          src="/src/assets/images/hero_saudi_livestock_1794608168927.jpg"
          alt={
            isEn
              ? 'Saudi livestock breeder with sheep herd amid desert mountains and date palms at sunset'
              : 'مِرباح — راعي أغنام سعودي مع قطيع من الأغنام وسط الجبال والنخيل عند الغروب'
          }
          width={1774}
          height={887}
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[35%_center] sm:object-[center_58%]"
        />
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${
            isEn
              ? 'bg-gradient-to-br from-[#081E15]/85 via-[#103C2C]/62 to-[#C79A43]/22'
              : 'bg-gradient-to-bl from-[#081E15]/85 via-[#103C2C]/62 to-[#C79A43]/22'
          }`}
        />

        <div
          dir={dir}
          className="relative mx-auto flex min-h-[265px] max-w-[1280px] flex-col items-center justify-center px-4 py-7 text-center sm:min-h-[440px] sm:items-start sm:px-6 sm:py-12 sm:text-start lg:px-8"
        >
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-lg border border-white/20 bg-[#0B241A]/55 px-3.5 py-1.5 backdrop-blur-sm sm:mb-5">
            <span className="h-[1.5px] w-4 shrink-0 bg-[#F4C569]" aria-hidden="true" />
            <span className="text-[12px] font-bold tracking-[0.02em] text-white/95">
              {isEn
                ? 'Digital Livestock Marketplace : Mirbah'
                : 'السوق الرقمي للمواشي : مِرباح'}
            </span>
          </div>

          <h1 className="mb-2 max-w-[640px] font-display text-[28px] font-black leading-[1.18] tracking-tight text-white text-balance sm:mb-3 sm:text-[42px]">
            {isEn ? (
              <>
                Find the right livestock,
                <br />
                <em className="text-[#F4C569] not-italic">deal with confidence.</em>
              </>
            ) : (
              <>
                اعثر على الماشية المناسبة،
                <br />
                <em className="text-[#F4C569] not-italic">واتفق بكل ثقة وأمان.</em>
              </>
            )}
          </h1>

          <p className="max-w-[500px] text-[13px] leading-[1.5] text-white/90 sm:text-[16px] sm:leading-[1.6] sm:text-white/80">
            {isEn
              ? 'Active breeders and livestock traders use Mirbah. Filter by region, type, and breed, and contact the seller directly.'
              : 'المربون وأصحاب المراحات النشطون يستخدمون مِرباح. صفِّ حسب المنطقة والنوع والسلالة، وتواصل مع البائع مباشرة.'}
          </p>
        </div>
      </section>

      {/* Overlapping Floating Filter Card */}
      <div
        dir={dir}
        className="relative z-10 mx-auto -mt-6 max-w-[1280px] px-4 sm:-mt-14 sm:px-6 lg:px-8"
      >
        {/* Mobile Trigger Button (< 640px) */}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen(true)}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-start shadow-[0_8px_26px_rgba(16,60,44,0.12)] dark:shadow-[0_8px_26px_rgba(0,0,0,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] sm:hidden cursor-pointer"
        >
          <SlidersHorizontal
            className="h-5 w-5 shrink-0 text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-extrabold text-[var(--color-ink)]">
              {isEn ? 'Filter listings' : 'تصفية الإعلانات'}
            </span>
            <span className="block truncate text-[11px] text-[var(--color-muted)]">
              {mobileSummaryText}
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-bold text-[var(--color-green-ink)] dark:text-[var(--color-gold)]">
            {isEn ? 'Change' : 'تغيير'}
          </span>
        </button>

        {/* Desktop & Tablet 4-Column Form (>= 640px) */}
        <form
          onSubmit={handleSubmit}
          aria-label={isEn ? 'Filter marketplace listings' : 'تصفية إعلانات السوق'}
          className="hidden gap-3 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_16px_48px_rgba(16,60,44,0.14)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] sm:grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end lg:gap-4 lg:p-5"
        >
          {/* Region / City */}
          <label htmlFor="hero-reg" className="block min-w-0">
            <span
              className={`mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-muted)] ${
                isEn ? 'uppercase tracking-[0.1em]' : ''
              }`}
            >
              <MapPin
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
                aria-hidden="true"
              />
              <span>{isEn ? 'Region' : 'المنطقة / المدينة'}</span>
            </span>
            <select
              id="hero-reg"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 text-[14px] font-semibold text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-green-ink)] focus:ring-2 focus:ring-[var(--color-gold)]/25 cursor-pointer"
            >
              <option value="all">{isEn ? 'All Regions' : 'جميع مناطق المملكة'}</option>
              {regions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {trRegionName(reg.name, lang)}
                </option>
              ))}
            </select>
          </label>

          {/* Type / Category */}
          <label htmlFor="hero-cat" className="block min-w-0">
            <span
              className={`mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-muted)] ${
                isEn ? 'uppercase tracking-[0.1em]' : ''
              }`}
            >
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
                aria-hidden="true"
              />
              <span>{isEn ? 'Type' : 'النوع'}</span>
            </span>
            <select
              id="hero-cat"
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 text-[14px] font-semibold text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-green-ink)] focus:ring-2 focus:ring-[var(--color-gold)]/25 cursor-pointer"
            >
              <option value="all">{isEn ? 'All Types' : 'جميع الأنواع'}</option>
              {mainCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {trCategoryName(cat.name, lang)}
                </option>
              ))}
            </select>
          </label>

          {/* Breed */}
          <label htmlFor="hero-breed" className="block min-w-0">
            <span
              className={`mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-muted)] ${
                isEn ? 'uppercase tracking-[0.1em]' : ''
              }`}
            >
              <Search
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
                aria-hidden="true"
              />
              <span>{isEn ? 'Breed' : 'السلالة'}</span>
            </span>
            <select
              id="hero-breed"
              value={breedId}
              onChange={(e) => setBreedId(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 text-[14px] font-semibold text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-green-ink)] focus:ring-2 focus:ring-[var(--color-gold)]/25 cursor-pointer"
            >
              <option value="all">{isEn ? 'All Breeds' : 'جميع السلالات'}</option>
              {availableBreeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {trBreedName(b.name, lang)}
                </option>
              ))}
            </select>
          </label>

          {/* Show Listings Submit Button */}
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] px-7 text-[14px] font-extrabold text-white transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 sm:col-span-2 lg:col-span-1 cursor-pointer whitespace-nowrap"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{isEn ? 'Show Listings' : 'عرض الإعلانات'}</span>
          </button>
        </form>
      </div>

      {/* Mobile Filter Dialog */}
      <Modal
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title={isEn ? 'Filter Listings' : 'تصفية الإعلانات'}
        subtitle={
          isEn
            ? 'Select region, livestock type, and breed to view matching listings.'
            : 'اختر المنطقة والنوع والسلالة لعرض الإعلانات المناسبة.'
        }
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4" dir={dir}>
          <label htmlFor="hero-mobile-reg" className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted)]">
              <MapPin
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
                aria-hidden="true"
              />
              <span>{isEn ? 'Region' : 'المنطقة / المدينة'}</span>
            </span>
            <select
              id="hero-mobile-reg"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 text-[14px] font-semibold text-[var(--color-ink)] outline-none focus:border-[var(--color-green-ink)] focus:ring-2 focus:ring-[var(--color-gold)]/25"
            >
              <option value="all">{isEn ? 'All Regions' : 'جميع مناطق المملكة'}</option>
              {regions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {trRegionName(reg.name, lang)}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="hero-mobile-cat" className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted)]">
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
                aria-hidden="true"
              />
              <span>{isEn ? 'Type' : 'النوع'}</span>
            </span>
            <select
              id="hero-mobile-cat"
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 text-[14px] font-semibold text-[var(--color-ink)] outline-none focus:border-[var(--color-green-ink)] focus:ring-2 focus:ring-[var(--color-gold)]/25"
            >
              <option value="all">{isEn ? 'All Types' : 'جميع الأنواع'}</option>
              {mainCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {trCategoryName(cat.name, lang)}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="hero-mobile-breed" className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted)]">
              <Search
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
                aria-hidden="true"
              />
              <span>{isEn ? 'Breed' : 'السلالة'}</span>
            </span>
            <select
              id="hero-mobile-breed"
              value={breedId}
              onChange={(e) => setBreedId(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 text-[14px] font-semibold text-[var(--color-ink)] outline-none focus:border-[var(--color-green-ink)] focus:ring-2 focus:ring-[var(--color-gold)]/25"
            >
              <option value="all">{isEn ? 'All Breeds' : 'جميع السلالات'}</option>
              {availableBreeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {trBreedName(b.name, lang)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2.5 pt-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-12 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer whitespace-nowrap"
              >
                {isEn ? 'Reset' : 'إعادة ضبط'}
              </button>
            )}
            <button
              type="submit"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] px-6 text-[14px] font-extrabold text-white transition-colors cursor-pointer"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{isEn ? 'Show Listings' : 'عرض الإعلانات'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
