"use client";

import { useState, useRef, useEffect, cloneElement, isValidElement } from "react";
import useNlToErd from "./useNlToErd"; // ✅ default import

// --- Constantes y Tipos ---
type Props = {
  trigger?: React.ReactNode;
  defaultValue?: string;
};

// Samples eliminados - ya no se usan

// --- Componente Principal ---
export default function NlToErdModal({ trigger, defaultValue = "" }: Props) {
  // ✅ el hook devuelve un objeto con métodos
  const { fromDescription /*, clearCanvas */ } = useNlToErd();

  const [text, setText] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Usamos una ref para el <dialog> nativo.
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 2. Efectos más limpios para abrir/cerrar el modal.
  const handleOpen = () => dialogRef.current?.showModal();
  const handleClose = () => dialogRef.current?.close();

  // 3. Enfocar el textarea cuando se abre el diálogo.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const observer = new MutationObserver(() => {
      if (dialog.hasAttribute("open")) {
        textareaRef.current?.focus();
      }
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError("Escribe una descripción para generar el diagrama.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // ✅ usamos el método del hook y reemplazamos el lienzo
      await fromDescription(text.trim(), { replace: true });
      setText("");
      handleClose(); // Cierra el modal al tener éxito
    } catch (e: any) {
      setError(e?.message ?? "Ocurrió un error al generar el diagrama.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Mejor manejo del 'trigger' con cloneElement para más flexibilidad.
  const triggerButton = isValidElement(trigger) ? (
    cloneElement(trigger as React.ReactElement, { onClick: handleOpen })
  ) : (
    <button
      type="button"
      onClick={handleOpen}
      className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow"
      title="Describe y te dibujo (NL → ERD)"
    >
      ✨ Describe y te dibujo
    </button>
  );

  return (
    <>
      {triggerButton}
      <dialog
        ref={dialogRef}
        onClose={() => !loading && handleClose()}
        className="w-full max-w-2xl rounded-3xl bg-transparent p-0 shadow-2xl backdrop:bg-black/60"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-600 via-gray-500 to-blue-600 p-[2px]">
          <div className="rounded-[22px] bg-white">
            <ModalContent
              text={text}
              setText={setText}
              loading={loading}
              error={error}
              textareaRef={textareaRef}
              onClose={handleClose}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}

// --- Sub-componentes para mejorar la legibilidad ---
type ModalContentProps = {
  text: string;
  setText: (text: string) => void;
  loading: boolean;
  error: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onClose: () => void;
  onSubmit: () => void;
};

function ModalContent({
  text,
  setText,
  loading,
  error,
  textareaRef,
  onClose,
  onSubmit,
}: ModalContentProps) {
  return (
    <div className="p-6">
      {/* Encabezado con Gradiente */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 bg-clip-text text-transparent">
            Describe tu diagrama
          </h2>
        </div>
        <button
          type="button"
          className="rounded-xl p-2 text-gray-400 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 hover:text-purple-600 transition-all disabled:opacity-50"
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Textarea */}
      <div className="mb-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-600 via-gray-500 to-blue-600 p-[2px]">
          <textarea
            ref={textareaRef}
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit();
            }}
            placeholder="Describe las entidades y relaciones de tu diagrama..."
            className="w-full resize-y rounded-[14px] border-0 p-4 text-sm outline-none focus:ring-0 bg-white"
            disabled={loading}
          />
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-pink-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Acciones */}
      <div className="mt-6 flex items-center justify-end gap-3 border-t-2 border-gray-100 pt-5">
        <button
          type="button"
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gradient-to-br hover:from-gray-50 hover:to-gray-100 transition-all disabled:opacity-50"
          onClick={onClose}
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 px-6 py-2.5 text-sm font-black text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-60 disabled:hover:scale-100"
          disabled={loading || !text.trim()}
        >
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" />
          )}
          {loading ? "Generando..." : "Generar"}
        </button>
      </div>
    </div>
  );
}
