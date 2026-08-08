import type { EventCollectionMeta } from "../../constants/types";
import type { ThemeMode } from "../../constants/theme";
import { LandingCollections } from "./LandingCollections";
import { LandingCta } from "./LandingCta";
import { LandingFeatureBlocks } from "./LandingFeatureBlocks";
import { LandingFooter } from "./LandingFooter";
import { LandingScrollStage } from "./LandingScrollStage";

type LandingPageProps = {
  theme: ThemeMode;
  catalogCollections: EventCollectionMeta[];
  onToggleTheme: () => void;
  onEnterTimeline: () => void;
  onOpenCollection: (collectionId: string) => void;
};

export function LandingPage({
  theme,
  catalogCollections,
  onToggleTheme,
  onEnterTimeline,
  onOpenCollection,
}: LandingPageProps) {
  return (
    <div className="landing-shell relative text-zinc-50">
      <div className="landing-orbit landing-orbit-left" aria-hidden="true" />
      <div className="landing-orbit landing-orbit-right" aria-hidden="true" />
      <div className="landing-noise absolute inset-0" aria-hidden="true" />

      <div className="relative z-10">
        <LandingScrollStage theme={theme} onEnterTimeline={onEnterTimeline} />
        <LandingFeatureBlocks />
        <LandingCollections
          collections={catalogCollections}
          onOpenCollection={onOpenCollection}
        />
        <LandingCta onEnterTimeline={onEnterTimeline} />
        <LandingFooter theme={theme} onToggleTheme={onToggleTheme} />
      </div>
    </div>
  );
}
