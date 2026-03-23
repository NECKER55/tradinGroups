import { FeaturedSquadsSection } from '../components/FeaturedSquadsSection';
import { HeroSection } from '../components/HeroSection';
import { WorkspacePreviewSection } from '../components/WorkspacePreviewSection';

export function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedSquadsSection />
      <WorkspacePreviewSection />
    </>
  );
}
