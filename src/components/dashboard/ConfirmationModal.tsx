

"use client";

import { useEffect } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }: Props) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
          {/* Header con ícono de advertencia */}
          <div className="bg-gradient-to-r from-red-500 to-pink-500 px-6 py-8 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 id="modal-title" className="text-2xl font-black text-white">
              Confirmar acción
            </h2>
          </div>

          {/* Contenido */}
          <div className="px-8 py-6 space-y-6">
            <p className="text-center text-gray-700 font-medium text-lg">
              {message}
            </p>

            {/* Botones de acción */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-gray-100 px-6 py-3.5 text-gray-700 font-bold hover:bg-gray-200 transition-all transform hover:scale-105"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3.5 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
