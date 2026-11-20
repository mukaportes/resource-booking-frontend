'use client';

import { useEffect, useState } from 'react';
import { logger } from '../../infrastructure/logger';

export function ErrorView({ retry }: { retry: () => void }) {
  const [reference] = useState(() => crypto.randomUUID());
  const [copyMessage, setCopyMessage] = useState('');
  useEffect(() => {
    logger.error('Unhandled rendering failure', { correlationId: reference });
  }, [reference]);
  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ code: 'UNEXPECTED_ERROR', correlationId: reference }),
      );
      setCopyMessage('Details copied.');
    } catch {
      setCopyMessage(`Clipboard unavailable. Error reference: ${reference}`);
    }
  }
  return (
    <main
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        maxWidth: 560,
        margin: '12vh auto',
        padding: 24,
        color: '#263846',
        background: '#fff',
      }}
    >
      <p style={{ color: '#245f89', fontWeight: 700 }}>ALVORADA / SPACES</p>
      <h1>The workspace hit a problem.</h1>
      <p>
        Your saved bookings have not been reset. Try opening the workspace
        again.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button style={{ padding: 12, minHeight: 44 }} onClick={retry}>
          Try again
        </button>
        <button
          style={{ padding: 12, minHeight: 44 }}
          onClick={() => {
            void copyDetails();
          }}
        >
          Copy details
        </button>
      </div>
      <p role="status">{copyMessage}</p>
    </main>
  );
}
