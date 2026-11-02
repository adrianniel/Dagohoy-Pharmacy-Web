import { ContactSection } from '../components/landing/ContactSection';
import { DeveloperCta } from '../components/landing/DeveloperCta';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { HeroSection } from '../components/landing/HeroSection';
import { LandingFooter } from '../components/landing/LandingFooter';
import { LandingNav } from '../components/landing/LandingNav';
import { useLandingScrollReveal } from '../components/landing/useLandingScrollReveal';

export function LandingPage() {
  useLandingScrollReveal();

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#landing-main">
        Skip to content
      </a>
      <LandingNav />
      <main id="landing-main">
        <HeroSection />
        <FeaturesSection />
        <DeveloperCta />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
