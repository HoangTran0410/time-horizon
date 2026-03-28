import React from "react";

type TimelineGuidanceAction = {
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary";
};

interface TimelineGuidanceOverlayProps {
  eyebrow: string;
  title: string;
  description: string;
  actions: TimelineGuidanceAction[];
  position?: "center" | "top";
}

export const TimelineGuidanceOverlay: React.FC<
  TimelineGuidanceOverlayProps
> = ({ eyebrow, title, description, actions, position = "center" }) => (
  <div
    className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${
      position === "center" ? "top-1/2 -translate-y-1/2" : "top-24"
    }`}
  >
    <div className="ui-guidance-panel pointer-events-auto w-full max-w-xl p-5 sm:p-6">
      <div className="ui-kicker ui-guidance-eyebrow mb-3">{eyebrow}</div>
      <h2 className="ui-guidance-title font-[Fraunces,'Times_New_Roman',serif] text-[1.8rem] leading-tight sm:text-[2.15rem]">
        {title}
      </h2>
      <p className="ui-guidance-copy mt-3 max-w-lg text-[0.95rem] leading-7">
        {description}
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={`ui-button px-4 py-2.5 text-[0.82rem] ${
              action.tone === "secondary"
                ? "ui-button-secondary"
                : "ui-button-primary"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);
