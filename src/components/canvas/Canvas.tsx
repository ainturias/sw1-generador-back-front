"use client";

import {
  useCanRedo,
  useCanUndo,
  useHistory,
  useMutation,
  useStorage,
} from "@liveblocks/react";
import {
  colorToCss,
  findIntersectionLayersWithRectangle,
  pointerEventToCanvasPoint,
  resizeBounds,
} from "~/utils";
import LayerComponent from "./LayerComponent";
import {
  Camera,
  CanvasMode,
  CanvasState,
  Layer,
  LayerType,
  Point,
  Side,
  XYWH,
} from "~/types";
import type { Anchor, EntityLayer, RelationLayer, RelationType, ProjectConfig } from "~/types";
import { nanoid } from "nanoid";
import { LiveObject } from "@liveblocks/client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ToolsBar from "../toolsbar/ToolsBar";
import SelectionBox from "./SelectionBox";
import useDeleteLayers from "~/hooks/useDeleteLayers";
import SelectionTools from "./SelectionTools";
import Sidebars from "../sidebars/Sidebars";
import MultiplayerGuides from "./MultiplayerGuides";
import { User } from "@prisma/client";

import { useSpringBootGenerator } from "../spring-generator/useSpringBootGenerator";
import { usePostmanCollectionGenerator } from "../spring-generator/usePostmanCollectionGenerator";
import { usePostgreSQLGenerator } from "../spring-generator/usePostgreSQLGenerator";
import { useFlutterGenerator } from "../spring-generator/useFlutterGenerator";

// dentro del bloque de botones de la barra superior en Canvas.tsx
import  useNlToErd  from "../ai/useNlToErd"; // 👈 importa el hook (ajusta ruta si difiere)
import NlToErdModal from "~/components/ai/NlToErdModal";
import ImageToErdModal from "~/components/ai/ImageToErdModal";
import { AudioToErdModal } from "~/components/ai/AudioToErdModal";
import ProjectConfigModal from "../settings/ProjectConfigModal";


import { useClassDiagramToFormsGenerator } from "~/hooks/useClassDiagramToFormsGenerator";

/* =========================================================
 * Helpers de tipado / guards para evitar "as any"
 * =======================================================*/
const isPressing = (s: CanvasState): s is CanvasState & { origin: Point } =>
  s.mode === CanvasMode.Pressing && "origin" in s;

const isDragging = (s: CanvasState): s is CanvasState & { origin: Point | null } =>
  s.mode === CanvasMode.Dragging && "origin" in s;

const isTranslating = (s: CanvasState): s is CanvasState & { current: Point } =>
  s.mode === CanvasMode.Translating && "current" in s;

const isResizing = (
  s: CanvasState,
): s is CanvasState & { initialBounds: XYWH; corner: Side } =>
  s.mode === CanvasMode.Resizing && "initialBounds" in s && "corner" in s;

const isSelectionNet = (
  s: CanvasState,
): s is CanvasState & { origin: Point; current: Point } =>
  s.mode === CanvasMode.SelectionNet && "origin" in s && "current" in s;

const isLinking = (
  s: CanvasState,
): s is CanvasState & {
  fromEntityId: string;
  fromAnchor: "L" | "R" | "T" | "B";
  relationType: RelationType;
  current?: Point;
} =>
  s.mode === CanvasMode.Linking &&
  "fromEntityId" in s &&
  "fromAnchor" in s &&
  "relationType" in s;

/* =========================================================
 * Utils locales
 * =======================================================*/
function asLiveEntity(layer: any): LiveObject<EntityLayer> | null {
  const t = layer?.get?.("type");
  return t === LayerType.Entity ? (layer as LiveObject<EntityLayer>) : null;
}

function getAnchorPoint(e: EntityLayer, a: "L" | "R" | "T" | "B") {
  const midY = e.y + e.height / 2;
  const midX = e.x + e.width / 2;
  switch (a) {
    case "L":
      return { x: e.x, y: midY };
    case "R":
      return { x: e.x + e.width, y: midY };
    case "T":
      return { x: midX, y: e.y };
    case "B":
      return { x: midX, y: e.y + e.height };
  }
}

/* =========================================================
 * Componente
 * =======================================================*/
export default function Canvas({
  roomName,
  roomId,
  othersWithAccessToRoom,
}: {
  roomName: string;
  roomId: string;
  othersWithAccessToRoom: User[];
}) {
  const generateSpringBoot = useSpringBootGenerator(roomName);
  const generatePostman = usePostmanCollectionGenerator(roomName);
  const generatePostgreSQL = usePostgreSQLGenerator(roomName);
  const generateFlutter = useFlutterGenerator(roomName);
  const { fromDescription } = useNlToErd(); 


  const [leftIsMinimized, setLeftIsMinimized] = useState(false);
  const layerIds = useStorage((root) => root.layerIds);
  const deleteLayers = useDeleteLayers();

  const [canvasState, setState] = useState<CanvasState>({ mode: CanvasMode.None });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType>("association");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const history = useHistory();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const classDiagramFileInputRef = useRef<HTMLInputElement>(null);

  // Project config from storage
  const projectConfig = useStorage((root) => root.projectConfig);

  // Save project config mutation
  const saveProjectConfig = useMutation(
    ({ storage }, config: ProjectConfig) => {
      storage.set("projectConfig", new LiveObject(config));
    },
    [],
  );

  //!---------------------------------------------------------
    async function handleDescribeToErd() {
    const defaultText =
      "Una Persona tiene muchas Casas y cada Casa pertenece a un Condominio";
    const prompt = window.prompt("Describe tu diagrama (NL → ERD)", defaultText);
    if (!prompt) return;

    try {
      // Si quieres reemplazar todo lo existente, usa { replace: true }
      await fromDescription(prompt, { replace: false });
    } catch (e: any) {
      alert(e?.message || "No se pudo generar el ERD");
    }
  }
  //!---------------------------------------------------------

  /* =========================================================
   * Acciones: seleccionar, exportar, importar
   * =======================================================*/
  const selectAllLayers = useMutation(
    ({ setMyPresence }) => {
      if (layerIds) {
        setMyPresence({ selection: [...layerIds] }, { addToHistory: true });
      }
    },
    [layerIds],
  );

  const exportToJSON = useMutation(
    ({ storage }) => {
      const layers = storage.get("layers").toImmutable();
      const layerIdsArray = storage.get("layerIds").toImmutable();

      const layersObject: Record<string, any> = {};
      layers.forEach((layer, id) => {
        layersObject[id] = JSON.parse(JSON.stringify(layer));
      });

      const canvasData = {
        layers: layersObject,
        layerIds: layerIdsArray,
        exportedAt: new Date().toISOString(),
        name: roomName,
      };

      const jsonString = JSON.stringify(canvasData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${roomName.replace(/\s+/g, "_")}_canvas_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [roomName],
  );

  const importFromJSON = useMutation(
    ({ storage, setMyPresence }, jsonData: any) => {
      try {
        if (!jsonData.layers || !jsonData.layerIds) {
          throw new Error("Invalid JSON format: missing layers or layerIds");
        }
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");

        // limpiar
        for (let i = liveLayerIds.length - 1; i >= 0; i--) liveLayerIds.delete(i);
        const existing = [...liveLayers.keys()];
        existing.forEach((id) => liveLayers.delete(id));

        // restaurar
        Object.entries(jsonData.layers).forEach(([id, layerData]) => {
          liveLayers.set(id, new LiveObject(layerData as Layer));
        });
        jsonData.layerIds.forEach((id: string) => liveLayerIds.push(id));

        setMyPresence({ selection: [] });
        setState({ mode: CanvasMode.None });
      } catch (e) {
        console.error("Error importing JSON:", e);
        alert("Error importing file. Please check the file format.");
      }
    },
    [],
  );

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(String(e.target?.result));
          importFromJSON(jsonData);
        } catch (err) {
          console.error("Error parsing JSON file:", err);
          alert("Invalid JSON file format");
        } finally {
          event.target.value = "";
        }
      };
      reader.readAsText(file);
    },
    [importFromJSON],
  );

  /* =========================================================
   * Generador desde diagrama (se mantiene igual)
   * =======================================================*/
  const {
    generateFormsFromDiagram,
    isProcessing: isProcessingClassDiagram,
    error: classDiagramError,
  } = useClassDiagramToFormsGenerator(importFromJSON);

  const handleGenerateFormsClick = () => classDiagramFileInputRef.current?.click();
  const handleClassDiagramFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      generateFormsFromDiagram(file);
      e.target.value = "";
    }
  };

  /* =========================================================
   * Atajos de teclado (undo/redo, export/import, etc.)
   * =======================================================*/
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      const isInput = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if (isInput) return;

      switch (e.key) {
        case "Backspace":
          deleteLayers();
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) e.shiftKey ? history.redo() : history.undo();
          break;
        case "a":
          if (e.ctrlKey || e.metaKey) selectAllLayers();
          break;
        case "s":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            exportToJSON();
          }
          break;
        case "o":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deleteLayers, exportToJSON, selectAllLayers, history]);

  /* =========================================================
   * Linking
   * =======================================================*/
  const startLinking = useCallback(
    (entityId: string, anchor: "L" | "R" | "T" | "B") => {
      setState({
        mode: CanvasMode.Linking,
        fromEntityId: entityId,
        fromAnchor: anchor,
        relationType: selectedRelationType
      });
    },
    [selectedRelationType],
  );

  const onLayerPointerDown = useMutation(
    ({ self, setMyPresence, storage }, e: React.PointerEvent, layerId: string) => {
      if (isLinking(canvasState)) {
        e.stopPropagation();

        // mismo origen -> sigue en linking
        if (layerId === canvasState.fromEntityId) return;

        const layers = storage.get("layers");
        const src = layers.get(canvasState.fromEntityId);
        const dst = layers.get(layerId);
        const isEntity = (l: any) => l?.get?.("type") === LayerType.Entity;

        if (isEntity(src) && isEntity(dst)) {
          const relationId = nanoid();
          const newRelation: RelationLayer = {
            type: LayerType.Relation,
            sourceId: canvasState.fromEntityId,
            targetId: layerId,
            relationType: canvasState.relationType,
            sourceCard: "ONE",
            targetCard: "ONE",
            owningSide: "target",
            opacity: 100,
          };

          layers.set(relationId, new LiveObject(newRelation));
          storage.get("layerIds").push(relationId);

          setState({ mode: CanvasMode.None });
        }
        return; // si no es entidad, sigue en Linking
      }

      if (canvasState.mode === CanvasMode.Inserting) return;

      history.pause();
      e.stopPropagation();

      if (!self.presence.selection.includes(layerId)) {
        setMyPresence({ selection: [layerId] }, { addToHistory: true });
      }

      if (e.nativeEvent.button === 2) {
        setState({ mode: CanvasMode.RightClick });
      } else {
        const point = pointerEventToCanvasPoint(e, camera);
        setState({ mode: CanvasMode.Translating, current: point });
      }
    },
    [camera, canvasState, history],
  );

  /* =========================================================
   * Mutations de edición (insert, translate, resize)
   * =======================================================*/
  const onResizeHandlePointerDown = useCallback(
    (corner: Side, initialBounds: XYWH) => {
      history.pause();
      setState({ mode: CanvasMode.Resizing, initialBounds, corner });
    },
    [history],
  );

  const insertEntity = useMutation(
    ({ storage, setMyPresence }, position: Point) => {
      const liveLayers = storage.get("layers");
      const liveLayerIds = storage.get("layerIds");
      const id = nanoid();

      const entity: EntityLayer = {
        type: LayerType.Entity,
        x: position.x,
        y: position.y,
        width: 240,
        height: 140,
        name: "NuevaEntidad",
        attributes: [
          { id: nanoid(), name: "id", type: "long", required: true, pk: true },
          { id: nanoid(), name: "nombre", type: "string" },
        ],
        opacity: 100,
      };

      liveLayers.set(id, new LiveObject(entity));
      liveLayerIds.push(id);
      setMyPresence({ selection: [id] }, { addToHistory: true });
      setState({ mode: CanvasMode.None });
    },
    [],
  );

  const translateSelectedLayers = useMutation(
    ({ storage, self }, point: Point) => {
      if (!isTranslating(canvasState)) return;

      const offset = {
        x: point.x - canvasState.current.x,
        y: point.y - canvasState.current.y,
      };

      const liveLayers = storage.get("layers");
      for (const id of self.presence.selection) {
        const anyLayer = liveLayers.get(id);
        const layer = asLiveEntity(anyLayer);
        if (!layer) continue;
        const x = (layer.get("x") as number) ?? 0;
        const y = (layer.get("y") as number) ?? 0;
        layer.update({ x: x + offset.x, y: y + offset.y });
      }
      setState({ mode: CanvasMode.Translating, current: point });
    },
    [canvasState],
  );

  const resizeSelectedLayer = useMutation(
    ({ storage, self }, point: Point) => {
      if (!isResizing(canvasState)) return;

      const bounds = resizeBounds(canvasState.initialBounds, canvasState.corner, point);
      const liveLayers = storage.get("layers");
      if (self.presence.selection.length > 0) {
        const anyLayer = liveLayers.get(self.presence.selection[0]!);
        const layer = asLiveEntity(anyLayer);
        if (layer) layer.update(bounds);
      }
    },
    [canvasState],
  );

  const unselectLayers = useMutation(({ self, setMyPresence }) => {
    if (self.presence.selection.length > 0) {
      setMyPresence({ selection: [] }, { addToHistory: true });
    }
  }, []);

  /* =========================================================
   * Eventos de canvas (wheel, pointer*)
   * =======================================================*/
  const onWheel = useCallback((e: React.WheelEvent) => {
    setCamera((camera) => ({
      x: camera.x - e.deltaX,
      y: camera.y - e.deltaY,
      zoom: camera.zoom,
    }));
  }, []);

  const onPointerDown = useMutation(
    ({}, e: React.PointerEvent) => {
      // no salir de Linking por click en fondo
      if (isLinking(canvasState)) return;

      const point = pointerEventToCanvasPoint(e, camera);
      if (isDragging(canvasState)) {
        setState({ mode: CanvasMode.Dragging, origin: point });
        return;
      }
      if (canvasState.mode === CanvasMode.Inserting) return;
      setState({ origin: point, mode: CanvasMode.Pressing });
    },
    [camera, canvasState, setState],
  );

  const startMultiSelection = useCallback((current: Point, origin: Point) => {
    if (Math.abs(current.x - origin.x) + Math.abs(current.y - origin.y) > 5) {
      setState({ mode: CanvasMode.SelectionNet, origin, current });
    }
  }, []);

  const updateSelectionNet = useMutation(
    ({ storage, setMyPresence }, current: Point, origin: Point) => {
      if (!layerIds) return;
      const layers = storage.get("layers").toImmutable();
      setState({ mode: CanvasMode.SelectionNet, origin, current });
      const ids = findIntersectionLayersWithRectangle(layerIds, layers, origin, current);
      setMyPresence({ selection: ids });
    },
    [layerIds],
  );

  // arriba del componente (o fuera):
type LinkingState = Extract<CanvasState, { mode: CanvasMode.Linking }>;
const isLinkingState = (s: CanvasState): s is LinkingState =>
  s.mode === CanvasMode.Linking;


  const onPointerMove = useMutation(
    ({ setMyPresence }, e: React.PointerEvent) => {
      const point = pointerEventToCanvasPoint(e, camera);

      if (isPressing(canvasState)) {
        startMultiSelection(point, canvasState.origin);
      } else if (isSelectionNet(canvasState)) {
        updateSelectionNet(point, canvasState.origin);
      } else if (isDragging(canvasState) && canvasState.origin !== null) {
        const { movementX, movementY } = e;
        setCamera((c) => ({ x: c.x + movementX, y: c.y + movementY, zoom: c.zoom }));
      } else if (isTranslating(canvasState)) {
        translateSelectedLayers(point);
      } else if (isResizing(canvasState)) {
        resizeSelectedLayer(point);
      } else if (canvasState.mode === CanvasMode.Linking) {
        setState(prev =>
          isLinkingState(prev) ? { ...prev, current: point } : prev
        );
      }

      setMyPresence({ cursor: point });
    },
    [camera, canvasState, translateSelectedLayers, resizeSelectedLayer, updateSelectionNet, startMultiSelection],
  );

  const onPointerLeave = useMutation(({ setMyPresence }) => {
    setMyPresence({ cursor: null });
  }, []);

  const onPointerUp = useMutation(
    ({}, e: React.PointerEvent) => {
      if (canvasState.mode === CanvasMode.RightClick) return;
      if (isLinking(canvasState)) return; // no cancelar Linking con up del fondo

      const point = pointerEventToCanvasPoint(e, camera);

      if (canvasState.mode === CanvasMode.None || isPressing(canvasState)) {
        unselectLayers();
        setState({ mode: CanvasMode.None });
      } else if (canvasState.mode === CanvasMode.Inserting) {
        insertEntity(point);
      } else if (isDragging(canvasState)) {
        setState({ mode: CanvasMode.Dragging, origin: null });
      } else {
        setState({ mode: CanvasMode.None });
      }
      history.resume();
    },
    [canvasState, setState, unselectLayers, history],
  );

  /* =========================================================
   * Linking preview
   * =======================================================*/
  const linkingSource = useStorage((root) =>
    isLinking(canvasState)
      ? (root.layers.get(canvasState.fromEntityId) as EntityLayer | undefined)
      : undefined,
  );

  const linkingPreview =
    isLinking(canvasState) && canvasState.current && linkingSource
      ? (() => {
          const p1 = getAnchorPoint(linkingSource, canvasState.fromAnchor);
          const p2 = canvasState.current;
          return (
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#3b82f6"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          );
        })()
      : null;

  /* =========================================================
   * Selection net
   * =======================================================*/
  const selectionNetRect =
    isSelectionNet(canvasState) ? (
      <rect
        className="fill-blue-600/5 stroke-blue-600 stroke-[0.5]"
        x={Math.min(canvasState.origin.x, canvasState.current.x)}
        y={Math.min(canvasState.origin.y, canvasState.current.y)}
        width={Math.abs(canvasState.origin.x - canvasState.current.x)}
        height={Math.abs(canvasState.origin.y - canvasState.current.y)}
      />
    ) : null;

  /* =========================================================
   * Render
   * =======================================================*/
  return (
    <div className="flex h-screen w-full">
      <main className="fixed left-0 right-0 h-screen overflow-y-auto">
        {/* input oculto: diagrama de clases */}
        <input
          type="file"
          ref={classDiagramFileInputRef}
          onChange={handleClassDiagramFileChange}
          accept="image/*"
          style={{ display: "none" }}
        />

        {/* barra superior - Compacta con Dropdowns */}
        <div className="absolute left-1/2 top-6 z-50 flex -translate-x-1/2 transform items-center gap-2">
          {/* Dropdown principal de Acciones */}
          <div className="relative group">
            <button className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 p-[2px] shadow-xl hover:shadow-2xl transition-all">
              <div className="relative rounded-[10px] bg-white px-5 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-600 to-blue-600 flex items-center justify-center shadow-md">
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
                <span className="text-sm font-black bg-gradient-to-r from-slate-700 to-blue-700 bg-clip-text text-transparent">
                  Acciones
                </span>
                <svg className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Dropdown Menu */}
            <div className="absolute left-0 top-full mt-2 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 animate-slideDown">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-600 via-gray-500 to-blue-600 p-[2px] shadow-2xl">
                <div className="rounded-[14px] bg-white p-3 space-y-1">
                  {/* Sección: Archivo */}
                  <div className="px-2 py-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1 w-1 rounded-full bg-gradient-to-r from-slate-600 to-blue-600"></div>
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Archivo</span>
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={exportToJSON}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 transition-all group/item"
                      >
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-600 to-blue-600 flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold text-gray-800">Exportar JSON</span>
                      </button>

                      <label className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 transition-all group/item cursor-pointer">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold text-gray-800">Importar JSON</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-2"></div>

                  {/* Sección: IA */}
                  <div className="px-2 py-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1 w-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Inteligencia Artificial</span>
                    </div>
                    <div className="space-y-1">
                      <NlToErdModal
                        trigger={
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 transition-all group/item"
                          >
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform">
                              <span className="text-white text-base">✨</span>
                            </div>
                            <span className="text-sm font-bold text-gray-800">Texto</span>
                          </button>
                        }
                      />

                      <ImageToErdModal
                        trigger={
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 transition-all group/item"
                          >
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-600 to-blue-600 flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform">
                              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <span className="text-sm font-bold text-gray-800">Imagen</span>
                          </button>
                        }
                      />

                      <AudioToErdModal
                        trigger={
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 transition-all group/item"
                          >
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform">
                              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                            </div>
                            <span className="text-sm font-bold text-gray-800">Audio</span>
                          </button>
                        }
                      />
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent my-2"></div>

                  {/* Sección: Generadores */}
                  <div className="px-2 py-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1 w-1 rounded-full bg-gradient-to-r from-emerald-600 to-green-600"></div>
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Generadores de Código</span>
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={generateSpringBoot}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all group/item"
                      >
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold text-gray-800">Spring Boot</span>
                      </button>

                      <button
                        onClick={generatePostman}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 transition-all group/item"
                      >
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-600 to-blue-600 flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold text-gray-800">Postman</span>
                      </button>

                      <button
                        onClick={generatePostgreSQL}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all group/item"
                      >
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold text-gray-800">PostgreSQL</span>
                      </button>

                      <button
                        onClick={generateFlutter}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50 transition-all group/item"
                      >
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform">
                          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14.314 0L2.3 12 6 15.7 21.684.013h-7.357zm.014 11.072L7.857 17.53l6.47 6.47H21.7l-6.46-6.468 6.46-6.46h-7.37z"/>
                          </svg>
                        </div>
                        <span className="text-sm font-bold text-gray-800">Flutter</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botón de Configuración */}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="relative overflow-hidden rounded-xl bg-gradient-to-r from-gray-600 to-gray-800 p-[2px] shadow-xl hover:shadow-2xl transition-all hover:scale-105"
          >
            <div className="relative rounded-[10px] bg-white px-4 py-3 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-md">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-sm font-black bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
                Config
              </span>
            </div>
          </button>
        </div>

        {/* Project Config Modal */}
        <ProjectConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSave={saveProjectConfig}
          initialConfig={projectConfig ?? undefined}
        />

        {/* lienzo */}
        <div
          style={{ backgroundColor: "#FFFFFF" }}
          className="h-full w-full touch-none bg-[radial-gradient(#E5E7EB_1px,transparent_1px)] [background-size:20px_20px]"
        >
          <SelectionTools camera={camera} canvasMode={canvasState.mode} />
          <svg
            className={`h-full w-full ${isLinking(canvasState) ? "linking" : ""}`}
            onWheel={onWheel}
            onPointerUp={onPointerUp}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onContextMenu={(e) => e.preventDefault()}
          >
            <g
              style={{
                transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
              }}
            >
              {layerIds?.map((layerId) => (
                <LayerComponent
                  key={layerId}
                  id={layerId}
                  onLayerPointerDown={onLayerPointerDown}
                  onStartLink={startLinking}
                />
              ))}

              {linkingPreview}
              <SelectionBox onResizeHandlePointerDown={onResizeHandlePointerDown} />
              {selectionNetRect}
              <MultiplayerGuides />
            </g>
          </svg>

          {/* Mientras linkeas, no bloquees clics con foreignObject ni texto */}
          <style jsx global>{`
            svg.linking foreignObject {
              pointer-events: none !important;
            }
            svg.linking g.relation {
              pointer-events: none !important;
            }
            svg:not(.linking) g.entity .entity-hit {
              pointer-events: none !important;
            }
            svg.linking g.entity .entity-hit {
              pointer-events: all !important;
            }
            svg.linking text,
            svg.linking tspan {
              pointer-events: none !important;
            }
          `}</style>
        </div>
      </main>

      <ToolsBar
        canvasState={canvasState}
        setCanvasState={(s) => setState(s)}
        selectedRelationType={selectedRelationType}
        setSelectedRelationType={setSelectedRelationType}
        zoomIn={() => setCamera((c) => ({ ...c, zoom: c.zoom + 0.1 }))}
        zoomOut={() => setCamera((c) => ({ ...c, zoom: c.zoom - 0.1 }))}
        canZoomIn={camera.zoom < 2}
        canZoomOut={camera.zoom > 0.5}
        redo={() => history.redo()}
        undo={() => history.undo()}
        canRedo={canRedo}
        canUndo={canUndo}
      />

      <Sidebars
        roomName={roomName}
        roomId={roomId}
        othersWithAccessToRoom={othersWithAccessToRoom}
        leftIsMinimized={leftIsMinimized}
        setLeftIsMinimized={setLeftIsMinimized}
      />
    </div>
  );
}
