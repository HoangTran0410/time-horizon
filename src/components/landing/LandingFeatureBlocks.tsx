import { Layers3, MapPin, Telescope } from "lucide-react";
import { useI18n } from "../../i18n";

/**
 * Three alternating blocks. Illustrations are inline SVG/CSS on purpose: the
 * spatial block must not pull maplibre-gl into the main chunk.
 */
export function LandingFeatureBlocks() {
  const { t } = useI18n();

  const blocks = [
    {
      icon: Telescope,
      eyebrow: t("scaleShift"),
      title: t("featureZoomTitle"),
      copy: t("featureZoomCopy"),
      art: "zoom" as const,
    },
    {
      icon: Layers3,
      eyebrow: t("curatedLayers"),
      title: t("featureLayersTitle"),
      copy: t("featureLayersCopy"),
      art: "layers" as const,
    },
    {
      icon: MapPin,
      eyebrow: t("landingSpatialEyebrow"),
      title: t("landingFeatureSpatialTitle"),
      copy: t("landingFeatureSpatialCopy"),
      art: "spatial" as const,
    },
  ];

  return (
    <section className="landing-features">
      {blocks.map((block, index) => {
        const Icon = block.icon;
        return (
          <article
            key={block.title}
            className={`landing-feature-block ${
              index % 2 === 1 ? "landing-feature-block-flipped" : ""
            }`}
          >
            <div className="landing-feature-body">
              <div className="landing-feature-icon">
                <Icon size={18} strokeWidth={1.8} />
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
