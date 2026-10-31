import { useEffect, useState } from 'react';
import { ContactSection } from '../components/landing/ContactSection';
import { DeveloperCta } from '../components/landing/DeveloperCta';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { HeroSection } from '../components/landing/HeroSection';
import { LandingFooter } from '../components/landing/LandingFooter';
import { LandingNav } from '../components/landing/LandingNav';
import { PharmacySnapshot } from '../components/landing/PharmacySnapshot';
import { pharmacyProfile, staffOnDuty, weeklyHours } from '../components/landing/mockData';
import { getPharmacyStatus } from '../components/landing/pharmacyTime';

export function LandingPage() {
  const [now, setNow] = useState(() => new Date());
  const status = getPharmacyStatus(now, weeklyHours, pharmacyProfile.timezone);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#landing-main">
        Skip to content
      </a>
      <LandingNav />
      <main id="landing-main">
        <HeroSection status={status} />
        <section className="landing-pharmacy-overview" aria-labelledby="visit-heading">
          <div className="landing-overview-heading">
            <p className="eyebrow">At a glance</p>
            <h2 id="visit-heading">Plan your visit</h2>
            <p>Opening hours and the team on duty.</p>
          </div>
          <PharmacySnapshot status={status} staff={staffOnDuty} hours={weeklyHours} />
        </section>
        <FeaturesSection />
        <DeveloperCta />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
