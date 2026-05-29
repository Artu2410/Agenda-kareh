import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReleaseVersionBadge from './ReleaseVersionBadge';

vi.mock('../config/releaseInfo', () => ({
  getClientReleaseInfo: () => ({
    version: '2026.05.28-rc1',
    commit: 'd2275a3',
  }),
}));

describe('ReleaseVersionBadge', () => {
  it('renders the frontend and API release metadata', async () => {
    render(<ReleaseVersionBadge />);

    const badge = screen.getByRole('status');

    await waitFor(() => {
      expect(badge).toHaveTextContent('UI 2026.05.28-rc1 · d2275a3');
      expect(badge).toHaveTextContent('API 2026.05.28-rc1 · test · cb5f418');
    });

    expect(badge).toHaveAttribute(
      'aria-label',
      'UI 2026.05.28-rc1 · d2275a3 | API 2026.05.28-rc1 · cb5f418 · test · 2026-05-28T22:00:00.000Z'
    );
  });
});
