import React, { lazy, Suspense, useState } from "react";
import { Languages } from "lucide-react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n";

/**
 * The modal carries `motion`; the button does not. Keeping the split means the
 * landing page's entry chunk stays clear of the animation library — see
 * LanguagePickerDialog.
 */
const LanguagePickerDialog = lazy(() =>
  import("./LanguagePickerDialog").then((module) => ({
    default: module.LanguagePickerDialog,
  })),
);

interface LanguagePickerButtonProps {
  buttonClassName: string;
  textClassName?: string;
  showLabel?: boolean;
}

export const LanguagePickerButton: React.FC<LanguagePickerButtonProps> = ({
  buttonClassName,
  textClassName = "",
  showLabel = false,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  // The dialog owns its own exit animation, so it has to outlive `isOpen`.
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setHasOpened(true);
          setIsOpen(true);
        }}
        className={buttonClassName}
        aria-label={t("language")}
        title={t("language")}
      >
        <span className={textClassName}>
          <Languages size={15} />
        </span>
        {showLabel ? <span>{t("languageShort")}</span> : null}
      </button>

      {hasOpened && typeof document !== "undefined"
        ? createPortal(
            <Suspense fallback={null}>
              <LanguagePickerDialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
              />
            </Suspense>,
            document.body,
          )
        : null}
    </>
  );
};
