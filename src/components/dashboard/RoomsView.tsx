"use client";

import { Room } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmationModal from "./ConfirmationModal";
import { deleteRoom, updateRoomTitle } from "~/app/actions/rooms";

// Gradientes vibrantes modernos
const MODERN_GRADIENTS = [
  "from-purple-500 via-pink-500 to-red-500",
  "from-blue-500 via-cyan-500 to-teal-500",
  "from-green-500 via-emerald-500 to-lime-500",
  "from-orange-500 via-amber-500 to-yellow-500",
  "from-indigo-500 via-purple-500 to-pink-500",
  "from-rose-500 via-pink-500 to-fuchsia-500",
  "from-cyan-500 via-blue-500 to-indigo-500",
  "from-amber-500 via-orange-500 to-red-500",
];

export default function RoomsView({
  ownedRooms,
  roomInvites,
}: {
  ownedRooms: Room[];
  roomInvites: Room[];
}) {
  const [viewMode, setViewMode] = useState<"owns" | "shared">("owns");
  const [selected, setSelected] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const router = useRouter();
  const outerRef = useRef<HTMLDivElement>(null);

  const filteredRooms = useMemo(() => (
    viewMode === "owns" ? ownedRooms : roomInvites
  ), [viewMode, ownedRooms, roomInvites]);

  const roomGradients = useMemo(() => (
    filteredRooms.map((room, index) => ({
      id: room.id,
      gradient: MODERN_GRADIENTS[index % MODERN_GRADIENTS.length],
    }))
  ), [filteredRooms]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (outerRef.current && !outerRef.current.contains(e.target as Node)) {
        setSelected(null);
        setEditingId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEditSubmit = async (id: string) => {
    if (editedTitle.trim() !== "") {
      await updateRoomTitle(editedTitle, id);
    }
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (selected) {
      await deleteRoom(selected);
      setShowConfirmationModal(false);
      setSelected(null);
    }
  };

  return (
    <div ref={outerRef} className="space-y-8">
      {/* Tabs modernos con pill design */}
      <div className="flex items-center justify-between">
        <div className="inline-flex gap-2 p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl border border-gray-200/50">
          <ViewModeButton
            onSelect={() => setViewMode("owns")}
            active={viewMode === "owns"}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            }
            text="Mis Proyectos"
            count={ownedRooms.length}
          />
          <ViewModeButton
            onSelect={() => setViewMode("shared")}
            active={viewMode === "shared"}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            text="Compartidos"
            count={roomInvites.length}
          />
        </div>
      </div>

      {/* Grid de tarjetas moderno */}
      {filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 h-20 w-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-700 mb-1">No hay proyectos aquí</h3>
          <p className="text-sm text-gray-500">
            {viewMode === "owns" ? "Crea tu primer proyecto para empezar" : "Aún no tienes proyectos compartidos"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => {
            const gradient = roomGradients.find((g) => g.id === room.id)?.gradient ?? MODERN_GRADIENTS[0];
            const isEditing = editingId === room.id;

            return (
              <div
                key={room.id}
                className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200/80 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Header con gradiente */}
                <div 
                  className={`h-32 bg-gradient-to-br ${gradient} relative cursor-pointer`}
                  onClick={() => !isEditing && router.push("/dashboard/" + room.id)}
                >
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-16 h-16 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-5 space-y-3">
                  {isEditing ? (
                    <input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={() => handleEditSubmit(room.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSubmit(room.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="w-full rounded-lg border-2 border-slate-500 px-3 py-2 text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h3 
                      className="text-lg font-bold text-gray-800 line-clamp-1 cursor-pointer"
                      onClick={() => router.push("/dashboard/" + room.id)}
                    >
                      {room.title}
                    </h3>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium">
                      {room.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {/* Acciones */}
                  {viewMode === "owns" && (
                    <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(room.id);
                          setEditedTitle(room.title);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(room.id);
                          setShowConfirmationModal(true);
                        }}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-sm font-semibold text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Badge de estado */}
                {viewMode === "shared" && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-white/40 shadow-lg text-xs font-bold text-gray-700">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Compartido
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de confirmación */}
      <ConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={handleDelete}
        message="¿Seguro que deseas eliminar este proyecto?"
      />
    </div>
  );
}

function ViewModeButton({
  onSelect,
  active,
  icon,
  text,
  count,
}: {
  onSelect: () => void;
  active: boolean;
  icon: React.ReactNode;
  text: string;
  count: number;
}) {
  return (
    <button
      onClick={onSelect}
      className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
        active
          ? "bg-gradient-to-r from-slate-700 to-blue-700 text-white shadow-lg shadow-slate-200"
          : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
      }`}
    >
      {icon}
      <span>{text}</span>
      <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
        active ? "bg-white/25" : "bg-gray-200"
      }`}>
        {count}
      </span>
    </button>
  );
}
