import { useEffect, useState } from 'react';
import { AboutSection } from '../components/landing/AboutSection';
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
      <LandingNav />
      <main>
        <HeroSection />
        <PharmacySnapshot status={status} staff={staffOnDuty} hours={weeklyHours} />
        <FeaturesSection />
        <AboutSection />
        <DeveloperCta />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
