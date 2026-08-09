import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  CollectionGroupDefinition,
  EventCollectionMeta,
} from "../../constants/types";
import { groupCollectionsByDefinitions } from "../../helpers/collectionGroups";
import { getLocalizedText } from "../../helpers/localization";
import { useI18n } from "../../i18n";

/**
 * One horizontally scrollable card rail with its scroll affordances: edge
 * fade-out (masked on the rail itself, so it works over the landing page's
 * gradient backdrop) plus previous/next buttons on hover-capable devices.
 * `itemCount` re-checks scrollability when the rail's content changes.
 */
function CollectionRail({
  itemCount,
  scrollLeftLabel,
  scrollRightLabel,
  children,
}: {
  itemCount: number;
  scrollLeftLabel: string;
  scrollRightLabel: string;
  children: ReactNode;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollability = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanScrollLeft(rail.scrollLeft > 1);
    setCanScrollRight(
      rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1,
    );
  }, []);

  useEffect(() => {
    syncScrollability();
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncScrollability);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [itemCount, syncScrollability]);

  const scrollByPage = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * rail.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  return (
    <div className="landing-collections-rail-wrap">
      <div
        ref={railRef}
        className="landing-collections-rail"
        onScroll={syncScrollability}
        data-fade-left={canScrollLeft || undefined}
        data-fade-right={canScrollRight || undefined}
      >
        {children}
      </div>
      {canScrollLeft ? (
        <button
          type="button"
          className="landing-rail-nav landing-rail-nav-left"
          onClick={() => scrollByPage(-1)}
          aria-label={scrollLeftLabel}
        >
          <ChevronLeft size={18} />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          className="landing-rail-nav landing-rail-nav-right"
          onClick={() => scrollByPage(1)}
          aria-label={scrollRightLabel}
        >
          <ChevronRight size={18} />
        </button>
      ) : null}
    </div>
  );
}

type LandingCollectionsProps = {
  collections: EventCollectionMeta[];
  groupDefinitions: CollectionGroupDefinition[];
  onOpenCollection: (collectionId: string) => void;
};

/**
 * Catalog rails, one per topical folder from the data repo (a data repo
 * without folder definitions degrades to a single flat rail). Renders nothing
 * when the catalog is empty — the fetch failed, or data/server.cjs is not
 * running in dev. An empty skeleton would read as a broken page.
 */
export function LandingCollections({
  collections,
  groupDefinitions,
  onOpenCollection,
}: LandingCollectionsProps) {
  const { t, language } = useI18n();
  const groups = useMemo(
    () => groupCollectionsByDefinitions(collections, groupDefinitions),
    [collections, groupDefinitions],
  );

  if (collections.length === 0) return null;

  const renderCard = (collection: EventCollectionMeta) => (
    <button
      key={collection.id}
      type="button"
      className="landing-collection-card"
      onClick={() => onOpenCollection(collection.id)}
      aria-label={`${t("landingOpenCollection")}: ${collection.name}`}
    >
      <span className="landing-collection-emoji" aria-hidden="true">
        {collection.emoji}
      </span>
      <span className="landing-collection-name">{collection.name}</span>
      <span className="landing-collection-desc">{collection.description}</span>
    </button>
  );

  return (
    <section className="landing-collections">
      <div className="landing-collections-head">
        <h2 className="landing-section-title">
          {t("landingCollectionsHeading")}
        </h2>
        <p className="landing-copy">{t("landingCollectionsCopy")}</p>
      </div>

      {groups.length === 0 ? (
        <CollectionRail
          itemCount={collections.length}
          scrollLeftLabel={t("landingRailScrollLeft")}
          scrollRightLabel={t("landingRailScrollRight")}
        >
          {collections.map(renderCard)}
        </CollectionRail>
      ) : (
        groups.map((group) => (
          <div key={group.definition.id} className="landing-collections-group">
            <h3 className="landing-collections-group-title">
              {getLocalizedText(group.definition.name, language)}
              <span className="landing-collections-group-count">
                {group.collections.length}
              </span>
            </h3>
            <CollectionRail
              itemCount={group.collections.length}
              scrollLeftLabel={t("landingRailScrollLeft")}
              scrollRightLabel={t("landingRailScrollRight")}
            >
              {group.collections.map(renderCard)}
            </CollectionRail>
          </div>
        ))
      )}
    </section>
  );
}
