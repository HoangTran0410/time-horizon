import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Hand, MousePointer2, X } from "lucide-react";
import { useI18n } from "../i18n";

const STORAGE_KEY = "time-horizon:first-run-hint:v1";
/** Ignore interactions this soon after showing, so it can actually be read. */
const MIN_VISIBLE_MS = 2500;
const AUTO_HIDE_MS = 14000;

const readDismissed = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeDismissed = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Private mode / blocked storage: the hint just shows again next visit.
  }
};

interface TimelineFirstRunHintProps {
  /** Hold the hint back while something else (empty-state card, a dialog) is up. */
  isSuppressed: boolean;
}

/**
 * One-time, dismissible coach mark explaining how to move around the canvas.
 * The gestures are not discoverable — nothing on screen says the timeline
 * zooms — so first-time visitors (students, casual visitors) get one line of
 * help. It leaves on its own once they start interacting.
 *
 * Dismissal is a per-browser convenience, so it lives in localStorage rather
 * than the persisted (and Drive-synced) store.
 */
export const TimelineFirstRunHint: React.FC<TimelineFirstRunHintProps> = ({
  isSuppressed,
}) => {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [isCoarsePointer] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches,
  );

  useEffect(() => {
    if (isSuppressed || readDismissed()) return;
    const timeoutId = window.setTimeout(() => setIsVisible(true), 900);
    return () => window.clearTimeout(timeoutId);
  }, [isSuppressed]);

  useEffect(() => {
    if (!isVisible) return;
    const shownAt = performance.now();
    const dismiss = () => {
      writeDismissed();
      setIsVisible(false);
    };
    const handleInteraction = (event: Event) => {
      if (performance.now() - shownAt < MIN_VISIBLE_MS) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-first-run-hint]")) return;
      dismiss();
    };
    const autoHide = window.setTimeout(dismiss, AUTO_HIDE_MS);
    window.addEventListener("wheel", handleInteraction, { passive: true });
    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    return () => {
      window.clearTimeout(autoHide);
      window.removeEventListener("wheel", handleInteraction);
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [isVisible]);

  const shouldShow = isVisible && !isSuppressed;

  return (
    <AnimatePresence>
      {shouldShow ? (
        <motion.div
          data-first-run-hint
          role="status"
          className="pointer-events-none fixed inset-x-0 top-[4.75rem] z-50 flex justify-center px-4 md:top-5"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <div className="ui-panel pointer-events-auto flex max-w-md items-center gap-3 rounded-[1.2rem] py-2.5 pl-3.5 pr-2 text-[0.84rem] leading-5 text-zinc-200 md:max-w-xl">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
            >
              {isCoarsePointer ? (
                <Hand size={15} />
              ) : (
                <MousePointer2 size={15} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              {isCoarsePointer
                ? t("firstRunHintTouch")
                : t("firstRunHintPointer")}
            </span>
            <button
              type="button"
              onClick={() => {
                writeDismissed();
                setIsVisible(false);
              }}
              className="ui-icon-button h-10 w-10 shrink-0"
              aria-label={t("dismissHint")}
              title={t("dismissHint")}
            >
              <X width={14} height={14} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
