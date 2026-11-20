'use client';

import { useEffect, useState } from 'react';
import {
  readViewState,
  writeViewState,
  type ViewState,
} from '../lib/view-state';
import { notify } from '../lib/notifications';

export function useViewState() {
  const [state, setState] = useState(() => readViewState('').state);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      const parsed = readViewState(
        window.location.search,
        window.matchMedia('(max-width: 760px)').matches,
      );
      setState(parsed.state);
      if (parsed.unknownResources.length)
        notify.warning('Unknown resources were removed from the shared view.');
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${writeViewState(parsed.state, window.location.search)}${window.location.hash}`,
      );
      setReady(true);
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function update(patch: Partial<ViewState>) {
    const next = { ...state, ...patch };
    setState(next);
    window.history.pushState(
      null,
      '',
      `${window.location.pathname}${writeViewState(next, window.location.search)}${window.location.hash}`,
    );
  }
  return { state, update, ready };
}
