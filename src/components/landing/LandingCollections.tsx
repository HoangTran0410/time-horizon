import type { EventCollectionMeta } from "../../constants/types";
import { useI18n } from "../../i18n";

type LandingCollectionsProps = {
  collections: EventCollectionMeta[];
  onOpenCollection: (collectionId: string) => void;
};

/**
 * Catalog carousel. Renders nothing when the catalog is empty — the fetch
 * failed, or data/server.cjs is not running in dev. An empty skeleton would
 * read as a broken page.
 */
export function LandingCollections({
  collections,
  onOpenCollection,
}: LandingCollectionsProps) {
  const { t } = useI18n();

  if (collections.length === 0) return null;

  return (
    <section className="landing-collections">
      <div className="landing-collections-head">
        <h2 className="landing-section-title">
          {t("landingCollectionsHeading")}
        </h2>
        <p className="landing-copy">{t("landingCollectionsCopy")}</p>
      </div>

      <div className="landing-collections-rail">
        {collections.map((collection) => (
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
            <span className="landing-collection-desc">
              {collection.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
