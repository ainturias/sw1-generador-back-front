"use client";

import React, { useMemo } from "react";
import { useMutation, useOthers, useSelf, useStorage } from "@liveblocks/react";
import { nanoid } from "nanoid";
import Link from "next/link";
import { PiSidebarSimpleThin } from "react-icons/pi";
import { IoLayersOutline, IoCubeOutline, IoGitNetworkOutline } from "react-icons/io5";

import { Color, Layer, LayerType, EntityLayer, RelationLayer } from "~/types";
import { colorToCss, connectionIdToColor } from "~/utils";

import LayerButton from "./LayerButton";
import NumberInput from "./NumberInput";
import Dropdown from "./Dropdown";
import UserAvatar from "./UserAvatar";
import ShareMenu from "./ShareMenu";
import { User } from "@prisma/client";

/* ---------- UI helpers ---------- */
const Divider = () => <div className="my-3 h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent" />;

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-4 p-5">
    <div className="flex items-center gap-2">
      <div className="h-1 w-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600" />
      <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">{title}</h3>
    </div>
    {children}
  </div>
);

const Label = ({ text }: { text: string }) => (
  <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">{text}</p>
);

/* ---------- utils ---------- */
const toPojo = <T,>(maybeLive: any): T | null => {
  if (!maybeLive) return null;
  return typeof maybeLive.toImmutable === "function"
    ? (maybeLive.toImmutable() as T)
    : (maybeLive as T);
};

/* =============================== COMPONENTE =============================== */

export default function Sidebars({
  roomName,
  roomId,
  othersWithAccessToRoom,
  leftIsMinimized,
  setLeftIsMinimized,
}: {
  roomName: string;
  roomId: string;
  othersWithAccessToRoom: User[];
  leftIsMinimized: boolean;
  setLeftIsMinimized: (value: boolean) => void;
}) {
  const me = useSelf();
  const others = useOthers();

  const selectedLayerId = useSelf((me) => {
    const sel = me.presence.selection;
    return sel.length === 1 ? sel[0] : null;
  });

  const layers = useStorage((root) => root.layers);
  const layerIds = useStorage((root) => root.layerIds);

  const selectedLayer = useStorage((root) =>
    selectedLayerId ? (root.layers.get(selectedLayerId) as any) : null,
  );
  const selectedLayerPOJO = toPojo<Layer>(selectedLayer);

  const selection = useSelf((me) => me.presence.selection);
  const reversedLayerIds = useMemo(
    () => [...(layerIds ?? [])].reverse(),
    [layerIds],
  );

  const isLeftOpen = !leftIsMinimized;
  const hasSelection = !!selectedLayerPOJO;

  /* ---------------------------- Mutations ---------------------------- */
  // Actualizadores separados (evita el error de 'never' en useMutation)
  const updateEntity = useMutation(
    ({ storage }, patch: Partial<EntityLayer>) => {
      if (!selectedLayerId) return;
      const lo: any = storage.get("layers").get(selectedLayerId);
      if (!lo) return;
      lo.update(patch);
    },
    [selectedLayerId],
  );

  const updateRelation = useMutation(
    ({ storage }, patch: Partial<RelationLayer>) => {
      if (!selectedLayerId) return;
      const lo: any = storage.get("layers").get(selectedLayerId);
      if (!lo) return;
      lo.update(patch);
    },
    [selectedLayerId],
  );

  // Mutations para atributos
  const addAttribute = useMutation(
    ({ storage }) => {
      if (!selectedLayerId) return;
      const lo: any = storage.get("layers").get(selectedLayerId);
      if (!lo) return;
      const current = lo.toImmutable() as EntityLayer;
      const newAttr = {
        id: nanoid(),
        name: "nuevoCampo",
        type: "string",
        required: false,
        pk: false,
      };
      lo.update({ attributes: [...(current.attributes || []), newAttr] });
    },
    [selectedLayerId],
  );

  const updateAttribute = useMutation(
    ({ storage }, attrId: string, patch: any) => {
      if (!selectedLayerId) return;
      const lo: any = storage.get("layers").get(selectedLayerId);
      if (!lo) return;
      const current = lo.toImmutable() as EntityLayer;
      const attrs = current.attributes || [];
      const index = attrs.findIndex((a) => a.id === attrId);
      if (index < 0) return;
      const updated = [...attrs];
      updated[index] = { ...attrs[index], ...patch };
      lo.update({ attributes: updated });
    },
    [selectedLayerId],
  );

  const deleteAttribute = useMutation(
    ({ storage }, attrId: string) => {
      if (!selectedLayerId) return;
      const lo: any = storage.get("layers").get(selectedLayerId);
      if (!lo) return;
      const current = lo.toImmutable() as EntityLayer;
      const attrs = current.attributes || [];
      lo.update({ attributes: attrs.filter((a) => a.id !== attrId) });
    },
    [selectedLayerId],
  );

  // Wrapper amigable
  const updateSelected = (
    patch: Partial<EntityLayer> & Partial<RelationLayer>,
  ) => {
    if (!selectedLayerPOJO) return;
    if (selectedLayerPOJO.type === LayerType.Entity) {
      updateEntity(patch as Partial<EntityLayer>);
    } else if (selectedLayerPOJO.type === LayerType.Relation) {
      updateRelation(patch as Partial<RelationLayer>);
    }
  };

  /* =============================== RENDER =============================== */

  // Agrupar capas por tipo
  const { entities, relations } = useMemo(() => {
    const entities: string[] = [];
    const relations: string[] = [];

    if (layerIds) {
      layerIds.forEach((id) => {
        const lo: any = layers?.get(id);
        const layer = toPojo<Layer>(lo);
        if (!layer) return;

        if (layer.type === LayerType.Entity) {
          entities.push(id);
        } else if (layer.type === LayerType.Relation) {
          relations.push(id);
        }
      });
    }

    return { entities, relations };
  }, [layerIds, layers]);

  const layerListItem = (id: string) => {
    const lo: any = layers?.get(id);
    const layer = toPojo<Layer>(lo);
    if (!layer) return null;

    const isSelected = selection?.includes(id) ?? false;

    if (layer.type === LayerType.Entity) {
      const ent = layer as EntityLayer;
      return (
        <LayerButton
          key={id}
          layerId={id}
          text={ent.name ?? "Entidad"}
          isSelected={isSelected}
          icon={
            <IoCubeOutline className="h-5 w-5" />
          }
        />
      );
    }

    if (layer.type === LayerType.Relation) {
      const rel = layer as RelationLayer;
      const src = toPojo<EntityLayer>(layers?.get(rel.sourceId));
      const dst = toPojo<EntityLayer>(layers?.get(rel.targetId));
      const label = `${src?.name ?? "?"} → ${dst?.name ?? "?"}`;
      return (
        <LayerButton
          key={id}
          layerId={id}
          text={label}
          isSelected={isSelected}
          icon={
            <IoGitNetworkOutline className="h-5 w-5" />
          }
        />
      );
    }

    return null;
  };

  return (
    <>
      {/* --------- Sidebar IZQUIERDO --------- */}
      {isLeftOpen ? (
        <div className="fixed left-0 flex h-screen w-[260px] flex-col bg-gradient-to-b from-slate-50 via-gray-50 to-blue-50 border-r border-slate-100/50 shadow-xl">
          {/* Header con gradiente */}
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 p-5">
            <div className="absolute inset-0 bg-black/5" />
            <div className="relative flex items-center justify-between">
              <Link href="/dashboard" className="group flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span className="text-lg font-black text-white">F</span>
                </div>
              </Link>
              <button
                onClick={() => setLeftIsMinimized(true)}
                className="h-9 w-9 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <PiSidebarSimpleThin className="h-5 w-5 text-white" />
              </button>
            </div>
            <h2 className="mt-4 text-lg font-black text-white truncate drop-shadow-lg">
              {roomName}
            </h2>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

          {/* Lista de capas */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex items-center gap-2 mb-4 sticky top-0 bg-gradient-to-b from-slate-50 via-gray-50 to-transparent py-3 backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-blue-600 shadow-lg">
                <IoLayersOutline className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-sm font-black text-gray-800">Capas</h3>
              {layerIds && layerIds.length > 0 && (
                <span className="ml-auto rounded-full bg-gradient-to-r from-slate-600 to-blue-600 px-2.5 py-1 text-xs font-black text-white shadow-lg">
                  {layerIds.length}
                </span>
              )}
            </div>

            {!layerIds || layerIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-100">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 to-blue-100 flex items-center justify-center mb-3">
                  <IoLayersOutline className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-gray-700">No hay capas</p>
                <p className="text-xs text-gray-500 mt-1">Crea una entidad o relación</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Entidades */}
                {entities.length > 0 && (
                  <div className="rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-100/50 p-3 shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-slate-600 to-blue-600 flex items-center justify-center shadow-md">
                        <IoCubeOutline className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                        Entidades
                      </span>
                      <span className="ml-auto rounded-full bg-gradient-to-r from-slate-600 to-blue-600 px-2 py-0.5 text-xs font-black text-white shadow-md">
                        {entities.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {entities.map((id) => layerListItem(id))}
                    </div>
                  </div>
                )}

                {/* Relaciones */}
                {relations.length > 0 && (
                  <div className="rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-100/50 p-3 shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                        <IoGitNetworkOutline className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                        Relaciones
                      </span>
                      <span className="ml-auto rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-0.5 text-xs font-black text-white shadow-md">
                        {relations.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {relations.map((id) => layerListItem(id))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        // IZQ minimizado
        <div className="fixed left-3 top-3 z-50 flex h-[56px] w-[280px] items-center justify-between rounded-2xl bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 p-4 shadow-2xl backdrop-blur-xl">
          <Link href="/dashboard" className="group">
            <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <span className="text-base font-black text-white">F</span>
            </div>
          </Link>
          <h2 className="max-w-[180px] truncate text-sm font-black text-white drop-shadow-lg">
            {roomName}
          </h2>
          <button
            onClick={() => setLeftIsMinimized(false)}
            className="h-9 w-9 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all"
          >
            <PiSidebarSimpleThin className="h-5 w-5 text-white" />
          </button>
        </div>
      )}

      {/* --------- Sidebar DERECHO --------- */}
      {isLeftOpen || hasSelection ? (
        <div
          className={[
            "fixed right-0 flex w-[280px] flex-col bg-gradient-to-b from-purple-50 via-pink-50 to-blue-50 border-l border-purple-100/50 shadow-xl overflow-y-auto",
            leftIsMinimized && hasSelection ? "bottom-3 right-3 top-3 rounded-2xl" : "",
            !leftIsMinimized && !hasSelection ? "h-screen" : "",
            !leftIsMinimized && hasSelection ? "bottom-0 top-0 h-screen" : "",
          ].join(" ")}
        >
          {/* Avatares + Compartir */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 p-4">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {me && (
                <div className="flex-shrink-0">
                  <UserAvatar
                    color={connectionIdToColor(me.connectionId)}
                    name={me.info.name}
                  />
                </div>
              )}
              {others.map((o) => (
                <div key={o.connectionId} className="flex-shrink-0">
                  <UserAvatar
                    color={connectionIdToColor(o.connectionId)}
                    name={o.info.name}
                  />
                </div>
              ))}
            </div>
            <div className="ml-3 flex-shrink-0">
              <ShareMenu
                roomId={roomId}
                othersWithAccessToRoom={othersWithAccessToRoom}
              />
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-purple-300 to-transparent" />

          {/* Contenido según selección */}
          {hasSelection && selectedLayerPOJO ? (
            selectedLayerPOJO.type === LayerType.Entity ? (
              <>
                {/* ENTITY */}
                <Section title="Entidad">
                  <div>
                    <Label text="Nombre" />
                    <input
                      key={`entity-name-${selectedLayerId}`}
                      className="h-10 w-full rounded-xl border-2 border-purple-200 bg-white px-4 text-sm font-semibold text-gray-800 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all shadow-sm"
                      defaultValue={(selectedLayerPOJO as EntityLayer).name ?? "Entidad"}
                      onBlur={(e) => {
                        const v = e.currentTarget.value.trim() || "Entidad";
                        updateSelected({ name: v });
                      }}
                    />
                  </div>
                </Section>

                <Divider />
                <Section title="Atributos">
                  <div className="max-h-[400px] space-y-2.5 overflow-y-auto pr-1 scrollbar-hide">
                    {((selectedLayerPOJO as EntityLayer).attributes || []).map((attr, index) => (
                      <div 
                        key={attr.id} 
                        className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-lg hover:shadow-2xl transition-all hover:scale-102"
                      >
                        {/* Card interno */}
                        <div className="relative rounded-[10px] bg-white p-4 space-y-3">
                          {/* Header del atributo con iconos */}
                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-100">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                                <span className="text-white text-xs font-black">#{index + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <input
                                  key={`attr-name-${attr.id}`}
                                  className="w-full bg-transparent text-base font-black text-gray-800 outline-none placeholder:text-gray-400 truncate"
                                  defaultValue={attr.name}
                                  placeholder="nombre del campo"
                                  onBlur={(e) => {
                                    const v = e.currentTarget.value.trim() || "campo";
                                    updateAttribute(attr.id, { name: v });
                                  }}
                                />
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-100 to-pink-100 text-[10px] font-black text-purple-700 uppercase tracking-wider">
                                    {attr.type ?? "string"}
                                  </span>
                                  {attr.pk && (
                                    <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-yellow-100 to-orange-100 text-[10px] font-black text-orange-700 uppercase">
                                      🔑 PK
                                    </span>
                                  )}
                                  {attr.required && (
                                    <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-red-100 to-pink-100 text-[10px] font-black text-red-700 uppercase">
                                      ⚠️ Req
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Botón eliminar compacto */}
                            <button
                              onClick={() => deleteAttribute(attr.id)}
                              className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white shadow-md hover:shadow-lg hover:scale-110 transition-all active:scale-95 opacity-70 group-hover:opacity-100"
                              title="Eliminar atributo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>

                          {/* Grid de controles */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Tipo de dato */}
                            <div className="col-span-2">
                              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                                Tipo de Dato
                              </label>
                              <div className="relative">
                                <select
                                  className="w-full h-10 rounded-lg border-2 border-gray-200 bg-gradient-to-r from-gray-50 to-purple-50 pl-3 pr-8 text-sm font-bold text-gray-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all cursor-pointer appearance-none"
                                  value={attr.type ?? "string"}
                                  onChange={(e) => updateAttribute(attr.id, { type: e.target.value })}
                                >
                                  <option value="string">📝 String</option>
                                  <option value="int">🔢 Integer</option>
                                  <option value="long">📊 Long</option>
                                  <option value="float">💫 Float</option>
                                  <option value="double">✨ Double</option>
                                  <option value="boolean">✓ Boolean</option>
                                  <option value="date">📅 Date</option>
                                  <option value="datetime">⏰ DateTime</option>
                                  <option value="uuid">🆔 UUID</option>
                                  <option value="email">📧 Email</option>
                                  <option value="password">🔒 Password</option>
                                </select>
                                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>

                            {/* Toggle switches */}
                            <div className="col-span-2 flex items-center gap-3 pt-1">
                              {/* Required Toggle */}
                              <label className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 cursor-pointer hover:shadow-md transition-all group/toggle">
                                <span className="text-xs font-black text-gray-700">Requerido</span>
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={attr.required ?? false}
                                    onChange={(e) => updateAttribute(attr.id, { required: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-cyan-500 transition-all shadow-inner"></div>
                                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-md"></div>
                                </div>
                              </label>

                              {/* PK Toggle */}
                              <label className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 cursor-pointer hover:shadow-md transition-all group/toggle">
                                <span className="text-xs font-black text-gray-700">PK</span>
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={attr.pk ?? false}
                                    onChange={(e) => updateAttribute(attr.id, { pk: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-yellow-500 peer-checked:to-orange-500 transition-all shadow-inner"></div>
                                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-md"></div>
                                </div>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Botón añadir atributo - Diseño nuevo */}
                  <button
                    onClick={() => addAttribute()}
                    className="group relative mt-3 w-full overflow-hidden rounded-xl bg-gradient-to-r from-slate-600 via-gray-500 to-blue-600 p-[2px] shadow-lg hover:shadow-2xl transition-all hover:scale-105 active:scale-95"
                  >
                    <div className="relative rounded-[10px] bg-white px-5 py-4 flex items-center justify-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-600 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-base font-black bg-gradient-to-r from-slate-700 to-blue-700 bg-clip-text text-transparent">
                        Añadir Nuevo Atributo
                      </span>
                    </div>
                  </button>
                </Section>
              </>
            ) : (
              <>
                {/* RELATION */}
                <Section title="Relación">
                  {(() => {
                    const rel = selectedLayerPOJO as RelationLayer;
                    const src = toPojo<EntityLayer>(layers?.get(rel.sourceId));
                    const dst = toPojo<EntityLayer>(layers?.get(rel.targetId));
                    return (
                      <div className="space-y-3 text-sm">
                        <div>
                          <Label text="Origen" />
                          <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-3 font-bold text-gray-800 shadow-sm">
                            {src?.name ?? rel.sourceId}
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </div>
                        <div>
                          <Label text="Destino" />
                          <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3 font-bold text-gray-800 shadow-sm">
                            {dst?.name ?? rel.targetId}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </Section>

                <Divider />
                <Section title="Tipo de Relación UML">
                  <Label text="Selecciona el tipo" />
                  <Dropdown
                    value={(selectedLayerPOJO as RelationLayer).relationType ?? "association"}
                    onChange={(v) =>
                      updateSelected({
                        relationType: v as RelationLayer["relationType"],
                      })
                    }
                    options={[
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
                              <marker id="uml-vee-open-sidebar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M0,0 L10,5 L0,10" fill="none" stroke="currentColor" strokeWidth="2"/>
                              </marker>
                            </defs>
                            <line x1="2" y1="10" x2="34" y2="10" stroke="currentColor" strokeWidth="1.5"
                                  strokeDasharray="3 2" markerEnd="url(#uml-vee-open-sidebar)"
                                  vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
                          </svg>
                        )
                      },
                    ]}
                  />
                </Section>

                <Divider />
                <Section title="Cardinalidades">
                  <div className="flex gap-2">
                    <div className="w-1/2">
                      <Label text="Source" />
                      <Dropdown
                        value={(selectedLayerPOJO as RelationLayer).sourceCard ?? "ONE"}
                        onChange={(v) =>
                          updateSelected({
                            sourceCard: (v as RelationLayer["sourceCard"]) ?? "ONE",
                          })
                        }
                        options={["ONE", "MANY"]}
                      />
                    </div>
                    <div className="w-1/2">
                      <Label text="Target" />
                      <Dropdown
                        value={(selectedLayerPOJO as RelationLayer).targetCard ?? "ONE"}
                        onChange={(v) =>
                          updateSelected({
                            targetCard: (v as RelationLayer["targetCard"]) ?? "ONE",
                          })
                        }
                        options={["ONE", "MANY"]}
                      />
                    </div>
                  </div>
                </Section>

                <Divider />
                <Section title="Propiedad (owning side)">
                  <Dropdown
                    value={(selectedLayerPOJO as RelationLayer).owningSide ?? "target"}
                    onChange={(v) =>
                      updateSelected({
                        owningSide: (v as RelationLayer["owningSide"]) ?? "target",
                      })
                    }
                    options={["source", "target"]}
                  />
                </Section>

                <Divider />
                <Section title="Apariencia">
                  <Label text="Opacidad" />
                  <NumberInput
                    value={selectedLayerPOJO.opacity ?? 100}
                    min={0}
                    max={100}
                    onChange={(n) => updateSelected({ opacity: n })}
                    classNames="w-full"
                    icon={<p>%</p>}
                  />
                </Section>
              </>
            )
          ) : null}
        </div>
      ) : (
        // DER minimizado
        <div className="fixed right-3 top-3 z-50 flex h-[56px] w-[280px] items-center justify-between rounded-2xl bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {me && (
              <div className="flex-shrink-0">
                <UserAvatar
                  color={connectionIdToColor(me.connectionId)}
                  name={me.info.name}
                />
              </div>
            )}
            {others.map((o) => (
              <div key={o.connectionId} className="flex-shrink-0">
                <UserAvatar
                  color={connectionIdToColor(o.connectionId)}
                  name={o.info.name}
                />
              </div>
            ))}
          </div>
          <div className="ml-3 flex-shrink-0">
            <ShareMenu
              roomId={roomId}
              othersWithAccessToRoom={othersWithAccessToRoom}
            />
          </div>
        </div>
      )}
    </>
  );
}
