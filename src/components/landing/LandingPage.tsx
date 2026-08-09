import type {
  CollectionGroupDefinition,
  EventCollectionMeta,
} from "../../constants/types";
import type { ThemeMode } from "../../constants/theme";
import { LandingCollections } from "./LandingCollections";
import { LandingCta } from "./LandingCta";
import { LandingFeatureBlocks } from "./LandingFeatureBlocks";
import { LandingFooter } from "./LandingFooter";
import { LandingScrollStage } from "./LandingScrollStage";
import { LandingTopBar } from "./LandingTopBar";
import { useLandingSmoothWheel } from "./useLandingSmoothWheel";

type LandingPageProps = {
  theme: ThemeMode;
  catalogCollections: EventCollectionMeta[];
  catalogGroups: CollectionGroupDefinition[];
  onToggleTheme: () => void;
  onEnterTimeline: () => void;
  onOpenCollection: (collectionId: string) => void;
};

export function LandingPage({
  theme,
  catalogCollections,
  catalogGroups,
  onToggleTheme,
  onEnterTimeline,
  onOpenCollection,
}: LandingPageProps) {
  useLandingSmoothWheel();

  return (
    <div className="landing-shell relative text-zinc-50">
      <div className="landing-orbit landing-orbit-left" aria-hidden="true" />
      <div className="landing-orbit landing-orbit-right" aria-hidden="true" />
      <div className="landing-noise absolute inset-0" aria-hidden="true" />

      <LandingTopBar theme={theme} onToggleTheme={onToggleTheme} />

      <div className="relative z-10">
        <LandingScrollStage
          theme={theme}
          collectionCount={catalogCollections.length}
          onEnterTimeline={onEnterTimeline}
        />
        <LandingFeatureBlocks />
        <LandingCollections
          collections={catalogCollections}
          groupDefinitions={catalogGroups}
          onOpenCollection={onOpenCollection}
        />
        <LandingCta onEnterTimeline={onEnterTimeline} />
        <LandingFooter />
      </div>
    </div>
  );
}
