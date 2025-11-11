import { User } from "@prisma/client";
import { useState } from "react";
import { IoClose, IoCheckmarkCircle, IoPeople } from "react-icons/io5";
import { deleteInvitation, shareRoom } from "~/app/actions/rooms";
import UserAvatar from "./UserAvatar";

export default function ShareMenu({
  roomId,
  othersWithAccessToRoom,
}: {
  roomId: string;
  othersWithAccessToRoom: User[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const inviteUser = async () => {
    if (!isValidEmail(email)) {
      setError("Por favor ingrese un correo electrónico válido");
      return;
    }

    setLoading(true);
    setError(undefined);
    setSuccess(undefined);

    const errorMessage = await shareRoom(roomId, email);

    if (errorMessage) {
      setError(errorMessage);
    } else {
      setSuccess(`Invitación enviada a ${email}`);
      setEmail("");
      setTimeout(() => setSuccess(undefined), 3000);
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && email && !loading) {
      inviteUser();
    }
  };

  const handleDeleteInvitation = async (userEmail: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el acceso de ${userEmail}?`)) {
      return;
    }

    setDeletingEmail(userEmail);
    await deleteInvitation(roomId, userEmail);
    setDeletingEmail(null);
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-600 via-blue-600 to-indigo-600 p-[2px] shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
      >
        <div className="relative rounded-[10px] bg-white px-4 py-2 flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-slate-600 to-blue-600 flex items-center justify-center">
            <IoPeople className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-black bg-gradient-to-r from-slate-600 to-blue-600 bg-clip-text text-transparent">
            Compartir
          </span>
          {othersWithAccessToRoom.length > 0 && (
            <div className="flex items-center justify-center min-w-[20px] h-5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2 shadow-md">
              <span className="text-[10px] font-black text-white">
                {othersWithAccessToRoom.length}
              </span>
            </div>
          )}
        </div>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-600 via-gray-500 to-blue-600 p-[2px] shadow-2xl">
              <div className="rounded-[22px] bg-white">
                {/* Encabezado con gradiente */}
                <div className="relative overflow-hidden bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 px-6 py-6">
                  <div className="absolute inset-0 bg-black/5" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg">
                        <IoPeople className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white drop-shadow-lg">
                          Compartir Proyecto
                        </h2>
                        <p className="text-xs text-white/80 font-medium">Colabora con tu equipo</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all"
                    >
                      <IoClose className="h-5 w-5 text-white" />
                    </button>
                  </div>
                </div>

                {/* Cuerpo */}
                <div className="space-y-5 px-6 py-6 bg-gradient-to-b from-slate-50/30 to-blue-50/30">
                  {/* Formulario de invitación */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-black text-gray-700 uppercase tracking-wider mb-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"></span>
                      Invitar por correo electrónico
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="email"
                          placeholder="correo@ejemplo.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setError(undefined);
                          }}
                          onKeyDown={handleKeyDown}
                          className="w-full h-12 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
                        />
                      </div>
                      <button
                        onClick={inviteUser}
                        disabled={loading || !email}
                        className={`h-12 rounded-xl px-6 text-sm font-black text-white shadow-lg transition-all ${
                          loading || !email
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl hover:scale-105 active:scale-95"
                        }`}
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Enviando
                          </span>
                        ) : (
                          "Invitar"
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Mensajes de error y éxito */}
                  {error && (
                    <div className="rounded-xl bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 px-4 py-3.5 animate-slideDown">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 h-6 w-6 rounded-lg bg-red-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold text-red-700">{error}</span>
                      </div>
                    </div>
                  )}

                  {success && (
                    <div className="rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 px-4 py-3.5 animate-slideDown">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-6 w-6 rounded-lg bg-green-500 flex items-center justify-center">
                          <IoCheckmarkCircle className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-bold text-green-700">{success}</span>
                      </div>
                    </div>
                  )}

                  {/* Lista de usuarios */}
                  {othersWithAccessToRoom.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"></span>
                        <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                          Personas con acceso
                        </span>
                        <div className="ml-auto flex items-center justify-center min-w-[24px] h-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 shadow-md">
                          <span className="text-xs font-black text-white">
                            {othersWithAccessToRoom.length}
                          </span>
                        </div>
                      </div>
                      <ul className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide pr-1">
                        {othersWithAccessToRoom.map((user, index) => (
                          <li
                            key={index}
                            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-600 via-gray-500 to-blue-600 p-[2px] shadow-md hover:shadow-xl transition-all"
                          >
                            <div className="relative rounded-[10px] bg-white px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <UserAvatar name={user.email ?? "Anónimo"} className="h-10 w-10 flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-bold text-gray-800 truncate">{user.email}</span>
                                  <span className="text-xs font-semibold text-blue-600">✓ Puede editar</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteInvitation(user.email)}
                                disabled={deletingEmail === user.email}
                                className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                                  deletingEmail === user.email
                                    ? "bg-gray-200 cursor-wait"
                                    : "bg-red-100 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 hover:scale-110 group/delete"
                                }`}
                                title="Eliminar acceso"
                              >
                                <IoClose
                                  className={`h-4 w-4 transition-colors ${
                                    deletingEmail === user.email
                                      ? "text-gray-400"
                                      : "text-red-600 group-hover/delete:text-white"
                                  }`}
                                />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {othersWithAccessToRoom.length === 0 && (
                    <div className="pt-2">
                      <div className="rounded-2xl bg-white border-2 border-dashed border-slate-200 py-12 text-center">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 to-blue-100 flex items-center justify-center mx-auto mb-3">
                          <IoPeople className="h-8 w-8 text-blue-400" />
                        </div>
                        <p className="text-sm font-bold text-gray-700">
                          Aún no has compartido este proyecto
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Invita a personas para colaborar
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
