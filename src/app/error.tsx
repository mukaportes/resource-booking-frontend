'use client';
import { ErrorView } from '@/ui/components/error-view';
export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <ErrorView retry={retry} />;
}
