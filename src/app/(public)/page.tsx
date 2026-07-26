import { FeaturedProperties } from '@/components/public/FeaturedProperties';
import { Hero } from '@/components/public/Hero';
import { OwnersCta } from '@/components/public/OwnersCta';
import { StatsBand } from '@/components/public/StatsBand';
import { ValuePillars } from '@/components/public/ValuePillars';

/**
 * `/` — landing page for the public zone (P4-Happy).
 *
 * Composes the five required sections in the order the spec calls for:
 * Hero → StatsBand → FeaturedProperties → ValuePillars → OwnersCta.
 * The site shell (SiteHeader / SiteFooter) is provided by the
 * `(public)/layout`, so this file only owns the page body.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBand />
      <FeaturedProperties />
      <ValuePillars />
      <OwnersCta />
    </>
  );
}
