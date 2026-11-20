import { Component, type ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import ErrorPage from '../../app/error';

class TestBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <ErrorPage error={this.state.error} retry={() => {}} />
    ) : (
      this.props.children
    );
  }
}
function BrokenRender(): ReactNode {
  throw new TypeError('owner@example.com private booking payload');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('copies the same reference as sanitized render-boundary diagnostic evidence', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const user = userEvent.setup();
  render(
    <TestBoundary>
      <BrokenRender />
    </TestBoundary>,
  );
  expect(
    screen.getByRole('heading', { name: 'The workspace hit a problem.' }),
  ).toBeVisible();
  const clipboard = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue();
  await user.click(screen.getByRole('button', { name: 'Copy details' }));
  await waitFor(() => expect(clipboard).toHaveBeenCalledOnce());
  const reference = JSON.parse(clipboard.mock.calls[0][0]).correlationId;
  const diagnostic = log.mock.calls.find(
    ([message]) =>
      message ===
      `[resource-booking:${reference}] Unexpected application failure`,
  );
  expect(diagnostic).toBeDefined();
  expect(diagnostic?.[1]).toMatchObject({
    type: 'TypeError',
    operation: 'ui.render',
    stack: expect.stringContaining('error-view.test.tsx:'),
  });
  expect(JSON.stringify(diagnostic)).not.toMatch(
    /owner@example|private booking/,
  );
});
