import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { getZoomRangeParts, type ZoomRangeUnit } from "../../helpers";
import { useI18n } from "../../i18n";

type LandingZoomGaugeProps = {
  /** Live camera zoom, in the same log space the viewport engine uses. */
  logZoom: MotionValue<number>;
  /** Length of the axis time runs along — the span shown is axisPx / zoom. */
  axisPx: number;
  /** Zoom at the first and last stop; the arc sweeps between them. */
  range: readonly [number, number];
};

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const UNIT_KEY: Record<ZoomRangeUnit, string> = {
  billionYears: "zoomUnitBillionYears",
  millionYears: "zoomUnitMillionYears",
  thousandYears: "zoomUnitThousandYears",
  years: "zoomUnitYears",
  months: "zoomUnitMonths",
  days: "zoomUnitDays",
  hours: "zoomUnitHours",
  minutes: "zoomUnitMinutes",
  seconds: "zoomUnitSeconds",
};

/**
 * A dial showing how much time fits on screen right now.
 *
 * The arc runs between the tour's own first and last zoom rather than the
 * engine's absolute limits: the engine can reach from the whole universe down
 * to one second, and the tour uses under half of that, so an absolute mapping
 * left the arc frozen near empty for the first half of the scroll. Log space
 * either way, which is the space the camera moves in — a steady scroll sweeps
 * the arc steadily.
 *
 * The reading is split in two on purpose. The number changes constantly, so it
 * is a motion value rendered straight into the DOM, outside React. The unit
 * changes a handful of times across the whole journey, so it is state, guarded
 * by a ref so an unchanged bucket never reaches the reconciler.
 */
export function LandingZoomGauge({
  logZoom,
  axisPx,
  range,
}: LandingZoomGaugeProps) {
  const { t } = useI18n();

  const readUnit = () => getZoomRangeParts(logZoom.get(), axisPx).unit;
  const [unit, setUnit] = useState<ZoomRangeUnit>(readUnit);
  const unitRef = useRef(unit);

  const applyUnit = (next: ZoomRangeUnit) => {
    if (next === unitRef.current) return;
    unitRef.current = next;
    setUnit(next);
  };

  const value = useTransform(logZoom, (current) =>
    String(getZoomRangeParts(current, axisPx).value),
  );

  const dashOffset = useTransform(logZoom, [...range], [CIRCUMFERENCE, 0], {
    clamp: true,
  });

  useMotionValueEvent(logZoom, "change", (current) => {
    applyUnit(getZoomRangeParts(current, axisPx).unit);
  });

  // Resizing changes the span without necessarily changing the zoom, so the
  // bucket has to be re-read rather than waiting on the next camera write.
  useEffect(() => {
    applyUnit(readUnit());
  });

  return (
    <div className="landing-zoom-gauge" aria-hidden="true">
      <svg className="landing-zoom-gauge-ring" viewBox="0 0 80 80">
        {/* Starts at twelve o'clock rather than three. */}
        <g transform="rotate(-90 40 40)">
          <circle
            className="landing-zoom-gauge-track"
            cx="40"
            cy="40"
            r={RADIUS}
          />
          <motion.circle
            className="landing-zoom-gauge-arc"
            cx="40"
            cy="40"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            style={{ strokeDashoffset: dashOffset }}
          />
        </g>
      </svg>

      <div className="landing-zoom-gauge-readout">
        <motion.span className="landing-zoom-gauge-value">{value}</motion.span>
        <span className="landing-zoom-gauge-unit">{t(UNIT_KEY[unit])}</span>
      </div>

      <div className="landing-zoom-gauge-caption">
        {t("landingZoomOnScreen")}
      </div>
    </div>
  );
}
