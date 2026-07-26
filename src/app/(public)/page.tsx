import { Benefits } from '@/components/public/Benefits';
import { ContactCTA } from '@/components/public/ContactCTA';
import { FeaturedProperties } from '@/components/public/FeaturedProperties';
import { Hero } from '@/components/public/Hero';

/**
 * `/` — landing page for the public zone (P4-Happy).
 * Composes the four required sections: hero, featured properties,
 * benefits, and contact CTA.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedProperties />
      <Benefits />
      <ContactCTA />
    </>
  );
}
