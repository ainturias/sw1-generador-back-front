"use client";

import { useMutation } from "@liveblocks/react";
import { ReactNode } from "react";

const LayerButton = ({
  layerId,
  text,
  icon,
  isSelected,
}: {
  layerId: string;
  text: string;
  icon: ReactNode;
  isSelected: boolean;
}) => {
  const updateSelection = useMutation(({ setMyPresence }, layerId: string) => {
    setMyPresence({ selection: [layerId] }, { addToHistory: true });
  }, []);

  return (
    <button
      className={`
        group flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm
        transition-all duration-200 w-full shadow-sm hover:shadow-md
        ${
          isSelected
            ? "bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-purple-400 scale-105"
            : "bg-white/80 backdrop-blur-sm border border-purple-100 hover:bg-white hover:border-purple-300 hover:scale-102"
        }
      `}
      onClick={() => updateSelection(layerId)}
    >
      <div className={`flex-shrink-0 transition-colors ${isSelected ? "text-white" : "text-purple-500 group-hover:text-purple-700"}`}>
        {icon}
      </div>
      <span className={`truncate font-bold ${isSelected ? "text-white" : "text-gray-700 group-hover:text-gray-900"}`}>
        {text}
      </span>
      {isSelected && (
        <div className="ml-auto flex-shrink-0">
          <div className="relative">
            <div className="absolute inset-0 h-3 w-3 rounded-full bg-white animate-ping opacity-75" />
            <div className="relative h-3 w-3 rounded-full bg-white shadow-lg" />
          </div>
        </div>
      )}
    </button>
  );
};

export default LayerButton;
