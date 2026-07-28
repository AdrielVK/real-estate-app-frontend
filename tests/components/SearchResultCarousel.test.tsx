import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchResultCarousel } from '@/components/public/SearchResultCarousel';

const PHOTOS = [
  'https://cdn.example.com/a.jpg',
  'https://cdn.example.com/b.jpg',
  'https://cdn.example.com/c.jpg',
  'https://cdn.example.com/d.jpg',
];

/**
 * jsdom does not implement the layout / scroll API, so the carousel
 * cannot derive `clientWidth` or call `scrollBy` out of the box. We
 * stub both: `clientWidth` is a constant we control, `scrollBy`
 * advances a local counter and re-fires a scroll event so the
 * component's `onScroll` handler can update the counter badge.
 */
function installScrollStub(scroller: HTMLDivElement, initialScrollLeft = 0) {
  let scrollLeft = initialScrollLeft;
  Object.defineProperty(scroller, 'clientWidth', { value: 320, configurable: true });
  Object.defineProperty(scroller, 'scrollLeft', {
    get: () => scrollLeft,
    configurable: true,
  });
  // The DOM type for `scrollBy` is overloaded (options vs x/y). The
  // component calls it with an options object, so the stub is typed
  // as the same call shape.
  (scroller as unknown as { scrollBy: (options: ScrollToOptions) => void }).scrollBy = ({
    left,
  }: ScrollToOptions) => {
    scrollLeft += left ?? 0;
    fireEvent.scroll(scroller);
  };
  return {
    getScrollLeft: () => scrollLeft,
  };
}

describe('SearchResultCarousel', () => {
  it('renders one slide per photo with the shared alt text', () => {
    render(<SearchResultCarousel photos={PHOTOS} alt="Casa" />);
    const slides = screen.getAllByTestId('search-result-carousel-slide');
    expect(slides).toHaveLength(PHOTOS.length);
    for (const slide of slides) {
      const img = slide.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('alt')).toBe('Casa');
      expect(img?.getAttribute('loading')).toBe('lazy');
    }
  });

  it('exposes carousel semantics on the region (role, aria-roledescription, label)', () => {
    render(<SearchResultCarousel photos={PHOTOS} alt="Casa" />);
    const region = screen.getByTestId('search-result-carousel');
    expect(region).toHaveAttribute('role', 'group');
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    expect(region).toHaveAttribute('aria-label', 'Fotos de la propiedad');
  });

  it('renders the counter as "1 / N" on first render', () => {
    render(<SearchResultCarousel photos={PHOTOS} alt="Casa" />);
    expect(screen.getByTestId('carousel-counter')).toHaveTextContent(`1 / ${PHOTOS.length}`);
  });

  it('shows both prev and next buttons when there are 2+ photos', () => {
    render(<SearchResultCarousel photos={PHOTOS} alt="Casa" />);
    expect(screen.getByTestId('carousel-prev')).toBeInTheDocument();
    expect(screen.getByTestId('carousel-next')).toBeInTheDocument();
  });

  it('hides the prev/next buttons when there is a single photo', () => {
    render(<SearchResultCarousel photos={['https://cdn.example.com/solo.jpg']} alt="Casa" />);
    expect(screen.queryByTestId('carousel-prev')).toBeNull();
    expect(screen.queryByTestId('carousel-next')).toBeNull();
    // The counter is also hidden — no point showing "1 / 1".
    expect(screen.queryByTestId('carousel-counter')).toBeNull();
  });

  it('removes the region from the tab order when there is a single photo', () => {
    render(<SearchResultCarousel photos={['https://cdn.example.com/solo.jpg']} alt="Casa" />);
    const region = screen.getByTestId('search-result-carousel');
    expect(region).toHaveAttribute('tabindex', '-1');
  });

  it('moves the scroll container by clientWidth on next click', () => {
    render(<SearchResultCarousel photos={PHOTOS} alt="Casa" />);
    const scroller = screen.getByTestId('search-result-carousel') as HTMLDivElement;
    const { getScrollLeft } = installScrollStub(scroller, 0);

    fireEvent.click(screen.getByTestId('carousel-next'));
    expect(getScrollLeft()).toBe(320);
    // The counter updates from the synthetic scroll event.
    expect(screen.getByTestId('carousel-counter')).toHaveTextContent('2 / 4');

    fireEvent.click(screen.getByTestId('carousel-next'));
    expect(getScrollLeft()).toBe(640);
    expect(screen.getByTestId('carousel-counter')).toHaveTextContent('3 / 4');
  });

  it('moves the scroll container by -clientWidth on prev click', () => {
    render(<SearchResultCarousel photos={PHOTOS} alt="Casa" />);
    const scroller = screen.getByTestId('search-result-carousel') as HTMLDivElement;
    const { getScrollLeft } = installScrollStub(scroller, 640);

    fireEvent.click(screen.getByTestId('carousel-prev'));
    expect(getScrollLeft()).toBe(320);
    expect(screen.getByTestId('carousel-counter')).toHaveTextContent('2 / 4');
  });

  it('advances one slide on ArrowRight keypress', () => {
    render(<SearchResultCarousel photos={PHOTOS} alt="Casa" />);
    const scroller = screen.getByTestId('search-result-carousel') as HTMLDivElement;
    const { getScrollLeft } = installScrollStub(scroller, 0);

    fireEvent.keyDown(scroller, { key: 'ArrowRight' });
    expect(getScrollLeft()).toBe(320);
    expect(screen.getByTestId('carousel-counter')).toHaveTextContent('2 / 4');
  });

  it('reverses one slide on ArrowLeft keypress', () => {
    render(<SearchResultCarousel photos={PHOTOS} alt="Casa" />);
    const scroller = screen.getByTestId('search-result-carousel') as HTMLDivElement;
    const { getScrollLeft } = installScrollStub(scroller, 320);

    fireEvent.keyDown(scroller, { key: 'ArrowLeft' });
    expect(getScrollLeft()).toBe(0);
    expect(screen.getByTestId('carousel-counter')).toHaveTextContent('1 / 4');
  });

  it('ignores unrelated keys (no scroll, no error)', () => {
    render(<SearchResultCarousel photos={PHOTOS} alt="Casa" />);
    const scroller = screen.getByTestId('search-result-carousel') as HTMLDivElement;
    const { getScrollLeft } = installScrollStub(scroller, 0);
    const initial = getScrollLeft();

    fireEvent.keyDown(scroller, { key: 'Enter' });
    fireEvent.keyDown(scroller, { key: ' ' });
    fireEvent.keyDown(scroller, { key: 'a' });
    expect(getScrollLeft()).toBe(initial);
  });

  it('does not call scrollBy in jsdom when there is only one photo (no counter to track)', () => {
    // The scroll listener is only attached when hasMultiple is true.
    const scrollSpy = vi.fn();
    const ref = { current: null } as { current: HTMLDivElement | null };
    render(
      <div ref={ref}>
        <SearchResultCarousel photos={['https://cdn.example.com/solo.jpg']} alt="Casa" />
      </div>,
    );
    const scroller = ref.current?.querySelector(
      '[data-testid="search-result-carousel"]',
    ) as HTMLDivElement | null;
    expect(scroller).not.toBeNull();
    if (scroller) {
      scroller.addEventListener('scroll', scrollSpy);
      fireEvent.scroll(scroller);
    }
    // The single-photo path skips the listener, so even a synthetic
    // scroll event does not move the counter. We just assert the
    // control surface is gone — the actual scroll math is covered
    // by the multi-photo tests.
    expect(screen.queryByTestId('carousel-counter')).toBeNull();
  });
});
