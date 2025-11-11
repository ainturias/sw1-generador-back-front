"use client";

import { useState } from "react";
import { createRoom, updateRoomTitle } from "~/app/actions/rooms";
import { useRouter } from "next/navigation";

export default function CreateRoom() {
  const [isOpen, setIsOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!roomName.trim()) return;

    setLoading(true);
    try {
      const roomId = await createRoom();
      await updateRoomTitle(roomName.trim(), roomId);
      router.push("/dashboard/" + roomId);
    } catch (err) {
      console.error("Error al crear el proyecto:", err);
    } finally {
      setLoading(false);
      setIsOpen(false);
      setRoomName("");
    }
  };

  return (
    <>
      {/* Hero card con CTA principal */}
      <div className="relative">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Contenido textual */}
          <div className="flex-1 text-white space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="text-sm font-semibold">Nuevo</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black leading-tight">
              ¿Listo para crear algo increíble?
            </h2>
            <p className="text-white/90 text-lg font-medium max-w-md">
              Inicia un nuevo proyecto y da vida a tus ideas con nuestras herramientas colaborativas.
            </p>
          </div>

          {/* Botón CTA grande */}
          <button
            onClick={() => setIsOpen(true)}
            className="group relative overflow-hidden rounded-2xl bg-white px-8 py-5 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-slate-600 to-blue-600 opacity-0 group-hover:opacity-10 transition-opacity" />
            <div className="relative flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-blue-600 shadow-lg group-hover:shadow-xl transition-shadow">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-xl font-black bg-gradient-to-r from-slate-600 to-blue-600 bg-clip-text text-transparent">
                  Crear Proyecto
                </p>
                <p className="text-sm text-gray-500 font-medium">
                  Comienza ahora →
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Modal moderno con efecto glassmorphism */}
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fadeIn">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full max-w-md transform transition-all animate-slideUp">
            <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
              {/* Header con gradiente */}
              <div className="bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 px-8 py-6">
                <h3 className="text-2xl font-black text-white">Nuevo Proyecto</h3>
                <p className="text-white/80 text-sm font-medium mt-1">Dale un nombre memorable a tu proyecto</p>
              </div>

              {/* Contenido */}
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Nombre del proyecto
                  </label>
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    placeholder="Mi proyecto increíble..."
                    autoFocus
                    className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-800 font-medium placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 rounded-xl bg-gray-100 px-6 py-3.5 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={loading || !roomName.trim()}
                    className={`flex-1 rounded-xl px-6 py-3.5 font-bold text-white shadow-lg transition-all ${
                      loading || !roomName.trim()
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl hover:scale-105"
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creando...
                      </span>
                    ) : (
                      "Crear Proyecto ✨"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
