import React, { useEffect, useRef, useState } from "react";
import type { EventCollectionMeta } from "../constants/types";
import EmojiPicker, { type Theme } from "emoji-picker-react";
import { ChevronDown, X } from "lucide-react";

type CollectionCreationInput = Pick<
  EventCollectionMeta,
  "emoji" | "name" | "description"
>;

interface CollectionEditorProps {
  onCreate: (collection: CollectionCreationInput) => void;
  onClose: () => void;
}

export const CollectionEditor: React.FC<CollectionEditorProps> = ({
  onCreate,
  onClose,
}) => {
  const closeTimeoutRef = useRef<number | null>(null);
  const shouldCloseOnPointerUpRef = useRef(false);
  const [draft, setDraft] = useState<CollectionCreationInput>({
    emoji: "🗂️",
    name: "",
    description: "",
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

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
      setError("Name is required.");
      return;
    }

    onCreate({
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
        className="ui-modal-surface w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8"
        data-ui-state={isClosing ? "closing" : "open"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">New Collection</h2>
          <button
            onClick={requestClose}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
            aria-label="Close"
          >
            <X width={20} height={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">
              Icon
            </label>
            <div className="relative">
              <button
                type="button"
                className="collection-emoji-trigger flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-left text-white transition-colors hover:border-zinc-600"
                onClick={() => setShowEmojiPicker((value) => !value)}
              >
                <span className="text-lg">{draft.emoji}</span>
                <ChevronDown width={14} height={14} className="text-zinc-500" />
              </button>
              {showEmojiPicker && (
                <div className="collection-emoji-trigger absolute z-10 mt-1">
                  <EmojiPicker
                    theme={"dark" as Theme}
                    onEmojiClick={(emojiData) => {
                      setDraft((prev) => ({ ...prev, emoji: emojiData.emoji }));
                      setShowEmojiPicker(false);
                    }}
                    height={400}
                    width={320}
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">
              Name
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, name: e.target.value }));
                setError(null);
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
              placeholder="Renaissance, Space Missions, Ancient Egypt..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">
              Description
            </label>
            <textarea
              value={draft.description}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, description: e.target.value }));
                setError(null);
              }}
              rows={4}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
              placeholder="A short description for what this collection covers."
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={requestClose}
            className="rounded-full bg-zinc-800 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            Create Collection
          </button>
        </div>
      </div>
    </div>
  );
};
