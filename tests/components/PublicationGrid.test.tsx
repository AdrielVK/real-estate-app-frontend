import { render, screen } from '@testing-library/react';

import { MOCK_PUBLICATIONS } from '@/lib/mock-data';

import { PublicationGrid } from '@/components/public/PublicationGrid';

describe('PublicationGrid', () => {
  it('renders one card per publication provided', () => {
    const { container } = render(<PublicationGrid publications={MOCK_PUBLICATIONS} />);
    const articles = container.querySelectorAll('article');
    expect(articles).toHaveLength(MOCK_PUBLICATIONS.length);
  });

  it('renders zero cards when given an empty list', () => {
    const { container } = render(<PublicationGrid publications={[]} />);
    expect(container.querySelectorAll('article')).toHaveLength(0);
  });

  // P5-Responsive: structural responsive classes (1/2/3 columns).
  it('uses responsive grid classes for 1, 2, and 3 column layouts', () => {
    const { container } = render(<PublicationGrid publications={MOCK_PUBLICATIONS.slice(0, 2)} />);
    const grid = container.firstChild as HTMLElement | null;
    expect(grid).not.toBeNull();
    if (!grid) throw new Error('grid element not found');
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/md:grid-cols-2/);
    expect(grid.className).toMatch(/lg:grid-cols-3/);
  });

  it('renders the title of every publication passed in', () => {
    render(<PublicationGrid publications={MOCK_PUBLICATIONS} />);
    for (const publication of MOCK_PUBLICATIONS) {
      expect(
        screen.getByRole('heading', { level: 3, name: publication.title }),
      ).toBeInTheDocument();
    }
  });
});
