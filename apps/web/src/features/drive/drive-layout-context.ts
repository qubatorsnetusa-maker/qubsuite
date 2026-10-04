import { createContext, useContext } from 'react';

/** Whether Drive's activity panel is open; the panel lives in the layout, its toggle in each page's toolbar. */
export const ActivityPanelContext = createContext<{ open: boolean; toggle(): void }>({ open: false, toggle: () => {} });

export const useActivityPanel = () => useContext(ActivityPanelContext);
