'use client';
import { ErrorView } from '@/ui/components/error-view';
export default function GlobalError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorView retry={retry} />
      </body>
    </html>
  );
}
