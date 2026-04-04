import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Languages, X } from "lucide-react";
import { createPortal } from "react-dom";
import { LANGUAGE_OPTIONS } from "../helpers/localization";
import { useI18n } from "../i18n";
import { useStore } from "../stores";

const dialogTransition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.85,
} as const;

interface LanguagePickerButtonProps {
  buttonClassName: string;
  textClassName?: string;
}

export const LanguagePickerButton: React.FC<LanguagePickerButtonProps> = ({
  buttonClassName,
  textClassName = "",
}) => {
  const { language, t } = useI18n();
  const setCurrentLanguage = useStore((state) => state.setCurrentLanguage);
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = useMemo(
    () =>
      LANGUAGE_OPTIONS.find((option) => option.value === language) ??
      LANGUAGE_OPTIONS[0],
    [language],
  );

  const modal =
    typeof document === "undefined" ? null : (
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            className="ui-modal-overlay fixed inset-0 z-110 flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsOpen(false);
              }
            }}
            onWheel={(event) => event.stopPropagation()}
          >
            <motion.div
              className="ui-modal-surface ui-panel w-full max-w-sm overflow-hidden rounded-[2rem]"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={dialogTransition}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <div className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(23,181,143,0.18),_transparent_50%)] px-6 pb-4 pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                    <Languages size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* <div className="ui-kicker">{t("language")}</div> */}
                    <h2 className="ui-display-title mt-2 text-[1.6rem] leading-tight text-white">
                      {t("chooseLanguage")}
                    </h2>
                    {/* <p className="mt-2 text-[0.92rem] leading-7 text-zinc-400">
                      {t("languagePickerDescription")}
                    </p> */}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="ui-icon-button h-10 w-10 shrink-0"
                    aria-label={t("closeLanguagePicker")}
                    title={t("closeLanguagePicker")}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 px-6 py-5">
                {LANGUAGE_OPTIONS.map((option) => {
                  const isActive = option.value === currentOption.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setCurrentLanguage(option.value);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-[1.25rem] border px-4 py-3.5 text-left transition-colors ${
                        isActive
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                          : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900"
                      }`}
                    >
                      <span
                        className="text-[1.45rem] leading-none"
                        aria-hidden="true"
                      >
                        {option.flag}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.98rem] font-semibold">
                          {option.label}
                        </div>
                        <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {isActive
                            ? t("currentLanguageLabel")
                            : option.shortLabel}
                        </div>
                      </div>
                      {isActive ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
                          <Check size={15} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={buttonClassName}
        aria-label={t("language")}
        title={t("language")}
      >
        <span className={{}}>
          {/* {currentOption.shortLabel} */}
          <Languages size={15} />
        </span>
      </button>
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
};
