import { useI18n } from "../../i18n";

/**
 * Three alternating blocks. Illustrations are inline SVG/CSS on purpose: the
 * spatial block must not pull maplibre-gl into the main chunk.
 *
 * Emoji rather than icon components, so the page speaks the same visual
 * language as the timeline it is advertising — every event in the catalog is
 * marked by one.
 */
export function LandingFeatureBlocks() {
  const { t } = useI18n();

  const blocks = [
    {
      icon: "🔭",
      eyebrow: t("scaleShift"),
      title: t("featureZoomTitle"),
      copy: t("featureZoomCopy"),
      art: "zoom" as const,
    },
    {
      icon: "🗂️",
      eyebrow: t("curatedLayers"),
      title: t("featureLayersTitle"),
      copy: t("featureLayersCopy"),
      art: "layers" as const,
    },
    {
      icon: "🗺️",
      eyebrow: t("landingSpatialEyebrow"),
      title: t("landingFeatureSpatialTitle"),
      copy: t("landingFeatureSpatialCopy"),
      art: "spatial" as const,
    },
  ];

  return (
    <section className="landing-features">
      {blocks.map((block, index) => {
        return (
          <article
            key={block.title}
            className={`landing-feature-block ${
              index % 2 === 1 ? "landing-feature-block-flipped" : ""
            }`}
          >
            <div className="landing-feature-body">
              <div className="landing-feature-icon" aria-hidden="true">
                {block.icon}
              </div>
              <div className="ui-kicker">{block.eyebrow}</div>
              <h2 className="landing-feature-title">{block.title}</h2>
              <p className="landing-feature-copy">{block.copy}</p>
            </div>
            <div
              className={`landing-feature-art landing-feature-art-${block.art}`}
              aria-hidden="true"
            />
          </article>
        );
      })}
    </section>
  );
}
