import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { useI18n } from "../i18n";

// Lazy-load the heavy emoji picker — only loaded when user opens the picker UI
const EmojiPicker = lazy(() =>
  import("emoji-picker-react").then((m) => ({ default: m.default })),
);
type EmojiPickerTheme = import("emoji-picker-react").Theme;
import type { CollectionCreationInput } from "../constants/types";

interface CollectionEditorProps {
  mode?: "create" | "edit";
  initialValue?: CollectionCreationInput | null;
  onSubmit: (collection: CollectionCreationInput) => void;
  onClose: () => void;
  title?: string;
}

export const CollectionEditor: React.FC<CollectionEditorProps> = ({
  mode = "create",
  initialValue = null,
  onSubmit,
  onClose,
  title,
}) => {
  const { t } = useI18n();
  const closeTimeoutRef = useRef<number | null>(null);
  const shouldCloseOnPointerUpRef = useRef(false);
  const [draft, setDraft] = useState<CollectionCreationInput>(
    initialValue ?? {
      emoji: "🗂️",
      name: "",
      description: "",
    },
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    setDraft(
      initialValue ?? {
        emoji: "🗂️",
        name: "",
        description: "",
      },
    );
    setError(null);
  }, [initialValue]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handler = (e: MouseEvent) => {
      const element = e.target as HTMLElement;
      if (!element.closest(".collection-emoji-trigger")) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    },
    [],
  );

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
    }, 180);
  };

  const handleSubmit = () => {
    const name = draft.name.trim();
    const description = draft.description.trim();

    if (!name) {
      setError(t("collectionNameRequired"));
      return;
    }

    onSubmit({
      emoji: draft.emoji.trim() || "🗂️",
      name,
      description,
    });
  };

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    shouldCloseOnPointerUpRef.current = e.target === e.currentTarget;
  };

  const handleBackdropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldCloseOnPointerUpRef.current && e.target === e.currentTarget) {
      requestClose();
    }

    shouldCloseOnPointerUpRef.current = false;
  };

  return (
    <div
      className="ui-modal-overlay fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4"
      data-ui-state={isClosing ? "closing" : "open"}
      onPointerDown={handleBackdropPointerDown}
      onPointerUp={handleBackdropPointerUp}
      onPointerCancel={() => {
        shouldCloseOnPointerUpRef.current = false;
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="ui-modal-surface ui-panel w-full max-w-md rounded-[1.9rem] p-6 sm:p-8"
        data-ui-state={isClosing ? "closing" : "open"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="ui-kicker mb-2">{t("libraryBuilder")}</div>

            <h2 className="ui-display-title text-[1.9rem] leading-none text-white">
              {title ??
                (mode === "edit" ? t("editCollection") : t("newCollection"))}
            </h2>
          </div>
          <button
            onClick={requestClose}
            className="ui-icon-button h-10 w-10"
            aria-label={t("close")}
          >
            <X width={20} height={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="ui-label">{t("icon")}</label>
            <div className="relative">
              <button
                type="button"
                className="collection-emoji-trigger ui-field flex items-center justify-between text-left"
                onClick={() => setShowEmojiPicker((value) => !value)}
              >
                <span className="text-lg">{draft.emoji}</span>
                <ChevronDown width={14} height={14} className="text-zinc-500" />
              </button>
              {showEmojiPicker && (
                <div className="collection-emoji-trigger absolute z-10 mt-1">
                  <Suspense
                    fallback={
                      <div className="flex h-[400px] w-[320px] items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-rose-400" />
                      </div>
                    }
                  >
                    <EmojiPicker
                      theme={"dark" as EmojiPickerTheme}
                      onEmojiClick={(emojiData) => {
                        setDraft((prev) => ({
                          ...prev,
                          emoji: emojiData.emoji,
                        }));
                        setShowEmojiPicker(false);
                      }}
                      height={400}
                      width={320}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="ui-label">{t("name")}</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, name: e.target.value }));
                setError(null);
              }}
              className="ui-field"
              placeholder={t("collectionNamePlaceholder")}
            />
          </div>

          <div>
            <label className="ui-label">{t("description")}</label>
            <textarea
              value={draft.description}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, description: e.target.value }));
                setError(null);
              }}
              rows={4}
              className="ui-field min-h-28 resize-y"
              placeholder={t("collectionDescriptionPlaceholder")}
            />
          </div>

          {error && (
            <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={requestClose}
            className="ui-button ui-button-secondary px-6 py-3"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            className="ui-button ui-button-primary px-6 py-3"
          >
            {mode === "edit" ? t("saveChanges") : t("newCollection")}
          </button>
        </div>
      </div>
    </div>
  );
};
