import type { MouseEvent } from 'react';
import type { ListingSummary, Locale, PriceStats } from '../../shared/types';
import { isSafeUrl } from '../../shared/url';
import { formatPrice } from '../utils/format';
import type { Strings } from '../utils/i18n';
import { IconExternal } from './Icons';

export interface ListingCardProps {
  listing: ListingSummary;
  s: Strings;
  locale: Locale;
  onOpen?: (listing: ListingSummary, ev: MouseEvent<HTMLAnchorElement>) => void;
}

/** Interactive listing card. Every value comes from the marketplace adapter (never from model text). */
export function ListingCard({ listing: l, s, locale, onOpen }: ListingCardProps) {
  const href = isSafeUrl(l.url) ? l.url : undefined;
  const img = isSafeUrl(l.imageUrl) ? l.imageUrl : undefined;
  const meta = [l.breed, l.category, [l.city, l.region].filter(Boolean).join(locale === 'ar' ? '، ' : ', ')].filter(Boolean).join(' · ');
  const price = formatPrice(l.price, l.currency, locale);
  return (
    <article className="sai-card" data-testid="listing-card">
      <div className="sai-card-media">
        {img ? <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="sai-card-ph" aria-hidden="true" />}
      </div>
      <div className="sai-card-body">
        <h4 className="sai-card-title" dir="auto">{l.title}</h4>
        {meta && <p className="sai-card-meta" dir="auto">{meta}</p>}
        {l.ageDescription && <p className="sai-card-meta" dir="auto">{l.ageDescription}</p>}
        <div className="sai-card-foot">
          {price && <strong className="sai-card-price">{price}</strong>}
          {href && (
            <a className="sai-card-link" href={href} onClick={(ev) => onOpen?.(l, ev)} target={onOpen ? undefined : '_self'}>
              {s.viewListing}
              <IconExternal className="sai-flip-rtl" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function StatsCard({ stats, s, locale }: { stats: PriceStats; s: Strings; locale: Locale }) {
  const cells: [string, number][] = [
    [s.statMin, stats.min],
    [s.statMedian, stats.median],
    [s.statAvg, stats.average],
    [s.statMax, stats.max],
  ];
  return (
    <section className="sai-stats" aria-label={s.statsTitle} data-testid="stats-card">
      <header>
        <strong>{s.statsTitle}</strong>
        <span>{s.statsBasis(stats.count)}</span>
      </header>
      <dl>
        {cells.map(([label, v]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatPrice(v, stats.currency, locale)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
