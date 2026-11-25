import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (children: ReactNode, p: P) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
    {children}
  </svg>
);

/**
 * Generic fallback launcher glyph. The host app should pass its OWN existing assistant icon via the
 * `launcherIcon` prop of <SouqAssistant/> so the current branding is preserved.
 */
export const IconSparkle = (p: P) => base(<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /><path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z" /></>, p);
export const IconSend = (p: P) => base(<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>, p);
export const IconStop = (p: P) => <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false" {...p}><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>;
export const IconMic = (p: P) => base(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0" /><path d="M12 18v3" /></>, p);
export const IconClip = (p: P) => base(<path d="M20 11.5l-7.8 7.8a5 5 0 01-7-7l8.2-8.2a3.3 3.3 0 014.7 4.7l-8.2 8.2a1.7 1.7 0 01-2.3-2.4l7.4-7.4" />, p);
export const IconX = (p: P) => base(<><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>, p);
export const IconCheck = (p: P) => base(<path d="M5 12.5l4.5 4.5L19 7.5" />, p);
export const IconCopy = (p: P) => base(<><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 017.5 4H15" /></>, p);
export const IconSpeaker = (p: P) => base(<><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" /><path d="M15.5 9a4 4 0 010 6" /><path d="M18 6.5a7.5 7.5 0 010 11" /></>, p);
export const IconRefresh = (p: P) => base(<><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 4v7h-7" /></>, p);
export const IconThumbUp = (p: P) => base(<><path d="M7 11v9H4v-9h3z" /><path d="M7 11l4-7c1.5 0 2.5 1.2 2.2 2.7L12.7 9H19a2 2 0 012 2.3l-1.2 7A2 2 0 0117.8 20H7" /></>, p);
export const IconThumbDown = (p: P) => base(<><path d="M17 13V4h3v9h-3z" /><path d="M17 13l-4 7c-1.5 0-2.5-1.2-2.2-2.7l.5-2.3H5a2 2 0 01-2-2.3l1.2-7A2 2 0 016.2 4H17" /></>, p);
export const IconHistory = (p: P) => base(<><path d="M3.5 12a8.5 8.5 0 102.6-6.1" /><path d="M3.5 4v4.5H8" /><path d="M12 8v4.5l3 1.8" /></>, p);
export const IconPlus = (p: P) => base(<><path d="M12 5v14" /><path d="M5 12h14" /></>, p);
export const IconSun = (p: P) => base(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>, p);
export const IconMoon = (p: P) => base(<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />, p);
export const IconGlobe = (p: P) => base(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" /></>, p);
export const IconCamera = (p: P) => base(<><path d="M4 8.5A1.5 1.5 0 015.5 7H8l1.3-2h5.4L16 7h2.5A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5v-9z" /><circle cx="12" cy="13" r="3.3" /></>, p);
export const IconSearch = (p: P) => base(<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>, p);
export const IconScale = (p: P) => base(<><path d="M12 4v16" /><path d="M7 20h10" /><path d="M5 7h14" /><path d="M5 7l-2.5 6a3 3 0 005 0L5 7z" /><path d="M19 7l-2.5 6a3 3 0 005 0L19 7z" /></>, p);
export const IconPen = (p: P) => base(<><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" /></>, p);
export const IconFile = (p: P) => base(<><path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M14 3v4h4" /></>, p);
export const IconTrash = (p: P) => base(<><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7l.8 12.5h9.4L17.5 7" /></>, p);
export const IconSpinner = (p: P) => base(<path d="M12 3a9 9 0 019 9" className="sai-spin" />, p);
export const IconAlert = (p: P) => base(<><path d="M12 3.5l9.5 16.5h-19L12 3.5z" /><path d="M12 10v4.5" /><path d="M12 17.5h.01" /></>, p);
export const IconExternal = (p: P) => base(<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>, p);
