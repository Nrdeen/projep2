import { useEffect, useState } from 'react';
import type { ConversationSummary, Locale } from '../../shared/types';
import type { Strings } from '../utils/i18n';
import { IconPlus, IconSpinner, IconTrash, IconX } from './Icons';

export interface HistoryDrawerProps {
  s: Strings;
  locale: Locale;
  items: ConversationSummary[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

export function HistoryDrawer({ s, locale, items, activeId, loading, onSelect, onDelete, onNew, onClose }: HistoryDrawerProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(null), 3500);
    return () => clearTimeout(t);
  }, [confirming]);
  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium' });

  return (
    <aside className="sai-history" aria-label={s.history} data-testid="history">
      <header className="sai-history-head">
        <strong>{s.history}</strong>
        <span className="sai-spacer" />
        <button type="button" className="sai-icon-btn" onClick={onNew} aria-label={s.newChat} title={s.newChat} data-testid="history-new"><IconPlus /></button>
        <button type="button" className="sai-icon-btn" onClick={onClose} aria-label={s.close} title={s.close}><IconX /></button>
      </header>
      {loading ? (
        <p className="sai-empty"><IconSpinner className="sai-spin-icon" /> {s.loading}</p>
      ) : items.length === 0 ? (
        <p className="sai-empty" data-testid="history-empty">{s.noHistory}</p>
      ) : (
        <ul className="sai-history-list">
          {items.map((c) => (
            <li key={c.id} className={c.id === activeId ? 'is-active' : undefined} data-testid="history-item">
              <button type="button" className="sai-history-open" onClick={() => onSelect(c.id)}>
                <span dir="auto" className="sai-history-title">{c.title}</span>
                <small>{fmt.format(new Date(c.updatedAt))}</small>
              </button>
              {confirming === c.id ? (
                <button type="button" className="sai-danger" onClick={() => { setConfirming(null); onDelete(c.id); }} data-testid="history-confirm-delete">{s.confirmDelete}</button>
              ) : (
                <button type="button" className="sai-icon-btn" aria-label={`${s.delete}: ${c.title}`} title={s.delete} onClick={() => setConfirming(c.id)} data-testid="history-delete"><IconTrash /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
