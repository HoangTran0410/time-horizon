/**
 * A ref is attached before the browser necessarily completes layout, so its
 * first client dimension can legitimately be zero. Treat that as unmeasured
 * rather than as a real viewport size; otherwise initial tick generation and
 * event layout receive a zero-length viewport and stay empty until zooming.
 */
export const resolveViewportDimension = (
  measuredDimension: number | null | undefined,
  fallbackDimension: number,
) =>
  typeof measuredDimension === "number" && measuredDimension > 0
    ? measuredDimension
    : fallbackDimension;