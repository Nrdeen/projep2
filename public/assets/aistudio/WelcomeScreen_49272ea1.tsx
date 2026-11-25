import type { ReactNode } from 'react';
import type { Strings } from '../utils/i18n';
import { IconCamera, IconPen, IconScale, IconSearch } from './Icons';

export type QuickAction = 'photo' | 'search' | 'compare' | 'ad';

export interface WelcomeScreenProps {
  s: Strings;
  icon: ReactNode;
  onAction: (a: QuickAction) => void;
  disabled?: boolean;
}

/** Compact welcome: title + a 2×2 grid of quick actions, designed to fit without scrolling on 1366×650 viewports. */
export function WelcomeScreen({ s, icon, onAction, disabled }: WelcomeScreenProps) {
  const cards: { id: QuickAction; icon: ReactNode; title: string; sub: string }[] = [
    { id: 'photo', icon: <IconCamera />, title: s.qaPhoto, sub: s.qaPhotoSub },
    { id: 'search', icon: <IconSearch />, title: s.qaSearch, sub: s.qaSearchSub },
    { id: 'compare', icon: <IconScale />, title: s.qaCompare, sub: s.qaCompareSub },
    { id: 'ad', icon: <IconPen />, title: s.qaAd, sub: s.qaAdSub },
  ];
  return (
    <div className="sai-welcome" data-testid="welcome">
      <div className="sai-welcome-head">
        <span className="sai-welcome-icon" aria-hidden="true">{icon}</span>
        <h2>{s.welcomeTitle}</h2>
        <p>{s.welcomeSub}</p>
      </div>
      <div className="sai-qa-grid" role="group" aria-label={s.quickActions} data-testid="qa-grid">
        {cards.map((c) => (
          <button key={c.id} type="button" className="sai-qa" onClick={() => onAction(c.id)} disabled={disabled} data-testid={`qa-${c.id}`}>
            <span className="sai-qa-ico" aria-hidden="true">{c.icon}</span>
            <strong>{c.title}</strong>
            <small>{c.sub}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
