import { FeaturedSquadsSection } from '../components/FeaturedSquadsSection';
import { HeroSection } from '../components/HeroSection';
import { WorkspacePreviewSection } from '../components/WorkspacePreviewSection';
import { useAuth } from '../../auth/context/AuthContext';

export function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <HeroSection />
      <FeaturedSquadsSection />
      {isAuthenticated ? <div className="mx-auto h-px w-full max-w-[1200px] bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" /> : null}
      <WorkspacePreviewSection />
    </>
  );
}
