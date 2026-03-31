import React, { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { X } from "lucide-react";

interface CollectionJsonEditorModalProps {
  collectionId: string;
  collectionName: string;
  jsonData: string;
  onSave: (json: string) => void;
  onClose: () => void;
}

export const CollectionJsonEditorModal: React.FC<
  CollectionJsonEditorModalProps
> = ({ collectionName, jsonData, onSave, onClose }) => {
  const [draft, setDraft] = useState(jsonData);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const shouldCloseOnPointerUpRef = useRef(false);

  const requestClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    // Call onClose after animation
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
    }, 160);
  }, [isClosing, onClose]);

  const handleSave = useCallback(() => {
    if (parseError) return;
    try {
      JSON.parse(draft);
      setParseError(null);
      onSave(draft);
      requestClose();
    } catch {
      setParseError("Invalid JSON — please fix errors before saving.");
    }
  }, [draft, onSave, parseError, requestClose]);

  const handleValidate = useCallback((value: string) => {
    if (!value.trim()) {
      setParseError(null);
      return;
    }
    try {
      JSON.parse(value);
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON syntax");
    }
  }, []);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void handleSave();
      });

      editor.addCommand(monaco.KeyCode.Escape, () => {
        requestClose();
      });
    },
    [handleSave, requestClose],
  );

  // Auto-validate on content change
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const v = value ?? "";
      setDraft(v);
      handleValidate(v);
    },
    [handleValidate],
  );

  // Keyboard listener on document (captures Escape even when editor is focused)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isClosing) {
        requestClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isClosing, requestClose]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

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
      className="ui-modal-overlay fixed inset-0 z-[200] flex items-stretch justify-center bg-black/80 p-4"
      data-ui-state={isClosing ? "closing" : "open"}
      onPointerDown={handleBackdropPointerDown}
      onPointerUp={handleBackdropPointerUp}
      onPointerCancel={() => {
        shouldCloseOnPointerUpRef.current = false;
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="ui-modal-surface ui-panel relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[1.6rem]"
        data-ui-state={isClosing ? "closing" : "open"}
        style={{ height: "min(92vh, 820px)" }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-5 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
          <div className="min-w-0">
            <div className="ui-kicker mb-1">JSON Editor</div>
            <h2 className="ui-display-title truncate text-[1.3rem] leading-none text-white sm:text-[1.5rem] sm:leading-none">
              {collectionName}
            </h2>
          </div>

          <button
            onClick={requestClose}
            className="ui-icon-button h-9 w-9 shrink-0"
            aria-label="Close editor"
          >
            <X size={16} />
          </button>
        </div>

        {/* Monaco Editor */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <Editor
            defaultLanguage="json"
            value={draft}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: true, side: "right" },
              fontSize: 13,
              fontFamily:
                "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true,
              lineNumbers: "on",
              renderLineHighlight: "line",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              formatOnPaste: true,
              tabSize: 2,
              bracketPairColorization: { enabled: true },
              suggest: {
                showWords: false,
              },
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
              },
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-800 px-5 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            {parseError ? (
              <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[0.78rem] text-rose-300">
                {parseError}
              </p>
            ) : (
              <p className="text-[0.78rem] text-zinc-500">
                {/* Press{" "}
                <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[0.7rem] text-zinc-300">
                  ⌘S
                </kbd>{" "}
                to save,{" "}
                <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[0.7rem] text-zinc-300">
                  Esc
                </kbd>{" "}
                to close. */}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={requestClose}
              className="ui-button ui-button-secondary rounded-[0.9rem] px-4 py-2 text-[0.82rem] sm:px-5 sm:py-2.5"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={Boolean(parseError)}
              className="ui-button ui-button-primary rounded-[0.9rem] px-4 py-2 text-[0.82rem] sm:px-5 sm:py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
