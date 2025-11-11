import { CanvasMode, CanvasState, LayerType, RelationType } from "~/types";
import { useState } from "react";
import SelectionButton from "./SelectionButton";
import ZoomInButton from "./ZoomInButton";
import ZoomOutButton from "./ZoomOutButton";
import UndoButton from "./UndoButton";
import RedoButton from "./RedoButton";

export default function ToolsBar({
  canvasState,
  setCanvasState,
  selectedRelationType,
  setSelectedRelationType,
  zoomIn,
  zoomOut,
  canZoomIn,
  canZoomOut,
  canUndo,
  canRedo,
  undo,
  redo,
}: {
  canvasState: CanvasState;
  setCanvasState: (newState: CanvasState) => void;
  selectedRelationType: RelationType;
  setSelectedRelationType: (type: RelationType) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}) {
  const isInsertEntityActive =
    canvasState.mode === CanvasMode.Inserting &&
    canvasState.layerType === LayerType.Entity;

  const handleInsertEntity = () =>
    setCanvasState({ mode: CanvasMode.Inserting, layerType: LayerType.Entity });

  const [isRelationDropdownOpen, setIsRelationDropdownOpen] = useState(false);

  const relationTypeOptions: Array<{ value: RelationType; label: string; icon: React.ReactNode }> = [
    {
      value: "association",
      label: "Asociación",
      icon: (
        <svg width="40" height="20" viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <line x1="2" y1="10" x2="38" y2="10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    },
    {
      value: "aggregation",
      label: "Agregación",
      icon: (
        <svg width="40" height="20" viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <line x1="12" y1="10" x2="38" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="2,10 7,6 12,10 7,14" stroke="currentColor" strokeWidth="1.5" fill="white" />
        </svg>
      )
    },
    {
      value: "composition",
      label: "Composición",
      icon: (
        <svg width="40" height="20" viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <line x1="12" y1="10" x2="38" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="2,10 7,6 12,10 7,14" stroke="currentColor" strokeWidth="1.5" fill="currentColor" />
        </svg>
      )
    },
    {
      value: "generalization",
      label: "Herencia",
      icon: (
        <svg width="40" height="20" viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <line x1="2" y1="10" x2="32" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="32,6 38,10 32,14" fill="white" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      value: "realization",
      label: "Implementación",
      icon: (
        <svg width="40" height="20" viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <line x1="2" y1="10" x2="32" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3, 2" />
          <polygon points="32,6 38,10 32,14" fill="white" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      value: "dependency",
      label: "Dependencia",
      icon: (
        <svg width="40" height="20" viewBox="0 0 40 20" role="img" aria-label="UML Dependencia" className="flex-shrink-0">
          <defs>
            <marker id="uml-vee-open-toolbar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10" fill="none" stroke="currentColor" strokeWidth="2"/>
            </marker>
          </defs>
          <line x1="2" y1="10" x2="34" y2="10" stroke="currentColor" strokeWidth="1.5"
                strokeDasharray="3 2" markerEnd="url(#uml-vee-open-toolbar)"
                vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
        </svg>
      )
    },
  ];

  const selectedOption = relationTypeOptions.find(opt => opt.value === selectedRelationType);
  const selectedLabel = selectedOption?.label || "";
  const selectedIcon = selectedOption?.icon;

  return (
    <div className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center">
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-600 via-gray-500 to-blue-600 p-[2px] shadow-2xl">
        <div className="rounded-[14px] bg-white px-5 py-3.5">
          <div className="flex items-center justify-center gap-4">
        {/* Selección */}
        <SelectionButton
          isActive={
            canvasState.mode === CanvasMode.None ||
            canvasState.mode === CanvasMode.Translating ||
            canvasState.mode === CanvasMode.SelectionNet ||
            canvasState.mode === CanvasMode.Pressing ||
            canvasState.mode === CanvasMode.Resizing ||
            canvasState.mode === CanvasMode.Dragging
          }
          canvasMode={canvasState.mode}
          onClick={(canvasMode) =>
            setCanvasState(
              canvasMode === CanvasMode.Dragging
                ? { mode: canvasMode, origin: null }
                : { mode: canvasMode },
            )
          }
        />

        {/* Insertar ENTIDAD */}
        <button
          type="button"
          title="Insertar Clase (C)"
          onClick={handleInsertEntity}
          className={`flex items-center gap-2 h-10 rounded-xl px-4 text-sm font-bold transition-all ${
            isInsertEntityActive
              ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105"
              : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 hover:from-blue-50 hover:to-cyan-50 hover:text-blue-600 hover:shadow-md active:scale-95"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Clase
        </button>

        <div className="h-8 w-px bg-gray-300" />

        {/* Selector de Tipo de Relación */}
        <div className="relative flex items-center gap-2.5">
          <span className="text-xs font-black text-gray-600 uppercase tracking-wider">Relación:</span>
          <div className="relative">
            <div className="overflow-hidden rounded-xl bg-gradient-to-r from-slate-600 via-gray-500 to-blue-600 p-[2px]">
              <button
                onClick={() => setIsRelationDropdownOpen(!isRelationDropdownOpen)}
                className="flex h-10 items-center gap-2 rounded-[10px] bg-white px-4 text-sm font-bold text-gray-700 transition-all hover:bg-gradient-to-br hover:from-slate-50 hover:to-blue-50 focus:outline-none"
                title="Selecciona el tipo de relación UML"
              >
                {selectedIcon && <span className="flex-shrink-0">{selectedIcon}</span>}
                <span>{selectedLabel}</span>
                <svg
                  className={`h-4 w-4 flex-shrink-0 transition-transform ${isRelationDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {isRelationDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-[100]"
                  onClick={() => setIsRelationDropdownOpen(false)}
                />
                <div className="absolute bottom-full left-0 z-[101] mb-3 w-72">
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-600 via-gray-500 to-blue-600 p-[2px] shadow-2xl animate-slideDown">
                    <div className="rounded-[14px] bg-white max-h-80 overflow-y-auto scrollbar-hide">
                      {relationTypeOptions.map((option) => {
                        const isSelected = option.value === selectedRelationType;
                        return (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSelectedRelationType(option.value);
                              setIsRelationDropdownOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold hover:bg-gradient-to-r first:rounded-t-[14px] last:rounded-b-[14px] transition-all ${
                              isSelected 
                                ? "bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 text-purple-600" 
                                : "text-gray-700 hover:from-purple-50 hover:to-pink-50"
                            }`}
                          >
                            <span className="flex-shrink-0">{option.icon}</span>
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="h-8 w-[2px] bg-gradient-to-b from-purple-200 via-pink-200 to-blue-200 rounded-full" />

        {/* Undo / Redo */}
        <div className="flex items-center justify-center">
          <UndoButton onClick={undo} disabled={!canUndo} />
          <RedoButton onClick={redo} disabled={!canRedo} />
        </div>

        <div className="h-8 w-[2px] bg-gradient-to-b from-purple-200 via-pink-200 to-blue-200 rounded-full" />

        {/* Zoom */}
        <div className="flex items-center justify-center">
          <ZoomInButton onClick={zoomIn} disabled={!canZoomIn} />
          <ZoomOutButton onClick={zoomOut} disabled={!canZoomOut} />
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
