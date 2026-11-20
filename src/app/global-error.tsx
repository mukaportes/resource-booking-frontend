'use client';
import { ErrorView } from '@/ui/components/error-view';
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorView error={error} retry={retry} />
      </body>
    </html>
  );
}
