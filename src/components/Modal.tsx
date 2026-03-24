import React from "react";
import { Event } from "../types";
import { formatYear } from "../utils";

interface ModalProps {
  event: Event;
  onClose: () => void;
}

export const Modal: React.FC<ModalProps> = ({ event, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-4xl border border-zinc-700">
            {event.emoji}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{event.title}</h2>
            <p className="text-emerald-500 font-mono text-sm mt-1">
              {formatYear(event.absoluteYear)}
            </p>
          </div>
        </div>
        <p className="text-zinc-300 leading-relaxed">{event.description}</p>
        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="bg-zinc-800 text-white px-6 py-2 rounded-full hover:bg-zinc-700 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
