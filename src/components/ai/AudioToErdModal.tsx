// src/components/ai/AudioToErdModal.tsx
"use client";

import { useState, useRef, cloneElement, isValidElement } from "react";
import { useAudioToErd } from "./useAudioToErd";

type Props = {
  trigger?: React.ReactNode;
};

export function AudioToErdModal({ trigger }: Props) {
  const {
    isRecording,
    isProcessing,
    error,
    audioBlob,
    audioDuration,
    startRecording,
    stopRecording,
    clearAudio,
    processAudio,
  } = useAudioToErd();

  const [activeTab, setActiveTab] = useState<"record" | "upload">("record");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpen = () => {
    clearAudio();
    setUploadedFile(null);
    setUploadError(null);
    setActiveTab("record");
    dialogRef.current?.showModal();
  };

  const handleClose = () => {
    if (!isProcessing && !isRecording) {
      clearAudio();
      setUploadedFile(null);
      setUploadError(null);
      dialogRef.current?.close();
    }
  };

  // Formatear duración
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Manejar grabación
  const handleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Manejar generación desde grabación
  const handleGenerateFromRecording = async () => {
    if (!audioBlob) return;

    try {
      await processAudio(audioBlob);
      handleClose();
    } catch (err) {
      // Error ya manejado en el hook
    }
  };

  // Manejar selección de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo
    if (!selectedFile.type.startsWith("audio/")) {
      setUploadError("Por favor selecciona un archivo de audio válido");
      return;
    }

    // Validar tamaño (20MB)
    const maxSize = 20 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setUploadError(
        `El archivo es muy grande (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB). Máximo: 20MB`
      );
      return;
    }

    setUploadError(null);
    setUploadedFile(selectedFile);
  };

  // Manejar drag & drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(droppedFile);
        input.files = dataTransfer.files;
        handleFileChange({ target: input } as any);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Manejar generación desde archivo
  const handleGenerateFromFile = async () => {
    if (!uploadedFile) {
      setUploadError("Por favor selecciona un archivo de audio");
      return;
    }

    setUploadError(null);

    try {
      await processAudio(uploadedFile);
      setUploadedFile(null);
      handleClose();
    } catch (e: any) {
      setUploadError(e?.message ?? "Error al procesar el audio");
    }
  };

  const triggerButton = isValidElement(trigger) ? (
    cloneElement(trigger as React.ReactElement, { onClick: handleOpen })
  ) : (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:from-orange-700 hover:to-red-700 hover:shadow-md active:scale-95"
      title="Generar diagrama desde audio"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
      Audio
    </button>
  );

  return (
    <>
      {triggerButton}
      <dialog
        ref={dialogRef}
        onClose={handleClose}
        className="w-full max-w-3xl rounded-3xl bg-transparent p-0 shadow-2xl backdrop:bg-black/60"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-600 via-gray-500 to-blue-600 p-[2px]">
          <div className="rounded-[22px] bg-white p-6">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-black bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 bg-clip-text text-transparent">
                  Generar Diagrama desde Audio
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Graba tu voz describiendo el diagrama o sube un archivo de audio
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl p-2 text-gray-400 hover:bg-gradient-to-br hover:from-orange-50 hover:to-red-50 hover:text-slate-700 transition-all disabled:opacity-50"
                onClick={handleClose}
                disabled={isProcessing || isRecording}
                aria-label="Cerrar"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex gap-2 border-b-2 border-gray-100">
              <button
                type="button"
                onClick={() => setActiveTab("record")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all ${
                  activeTab === "record"
                    ? "border-orange-600 text-orange-600 -mb-[2px]"
                    : "border-transparent text-gray-600 hover:text-orange-500"
                }`}
              >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
                Grabar Audio
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all ${
                  activeTab === "upload"
                    ? "border-orange-600 text-orange-600 -mb-[2px]"
                    : "border-transparent text-gray-600 hover:text-orange-500"
                }`}
              >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
                Subir Archivo
              </button>
            </div>

            {/* Tab: Grabar Audio */}
            {activeTab === "record" && (
              <>
              {/* Recording Status */}
              {(isRecording || audioBlob) && (
                <div className="mb-6 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-8 shadow-lg">
                  <div className="flex flex-col items-center justify-center gap-4">
                    {isRecording && (
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                        </span>
                        <span className="text-sm font-bold text-red-500 uppercase tracking-wider">Grabando</span>
                      </div>
                    )}
                    <span className="font-mono text-4xl font-bold text-slate-700">
                      {formatDuration(audioDuration)}
                    </span>
                    {audioBlob && !isRecording && (
                      <span className="text-sm font-medium text-green-600 flex items-center gap-2">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Grabación completada
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Recording Controls */}
              <div className="mb-4 flex justify-center">
                {!audioBlob ? (
                  <button
                    type="button"
                    onClick={handleRecord}
                    disabled={isProcessing}
                    className={`flex items-center gap-3 rounded-full px-8 py-4 text-base font-black text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all ${
                      isRecording
                        ? "bg-gradient-to-r from-red-600 to-pink-600"
                        : "bg-gradient-to-r from-orange-600 to-red-600"
                    } disabled:opacity-50 disabled:hover:scale-100`}
                  >
                    {isRecording ? (
                      <>
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <rect x="6" y="6" width="12" height="12" />
                        </svg>
                        Detener Grabación
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>
                        Iniciar Grabación
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-2 text-sm text-gray-700 shadow-sm">
                      <svg
                        className="h-5 w-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="font-medium">
                        Grabación lista ({formatDuration(audioDuration)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={clearAudio}
                      disabled={isProcessing}
                      className="text-sm font-bold text-orange-600 hover:text-red-600 hover:underline transition-colors disabled:opacity-50"
                    >
                      Descartar
                    </button>
                  </div>
                )}
              </div>
              </>
            )}

            {/* Tab: Subir Archivo */}
            {activeTab === "upload" && (
              <>
                {/* Upload Area */}
                <div
                  className={`relative mb-4 rounded-2xl border-2 border-dashed p-8 transition-all ${
                    uploadedFile
                      ? "border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50"
                      : "border-gray-300 bg-gradient-to-br from-slate-50 to-blue-50 hover:border-slate-400 hover:shadow-lg"
                  }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isProcessing}
                />

                {uploadedFile ? (
                  // Preview del archivo
                  <div className="flex flex-col items-center">
                    <svg
                      className="mb-4 h-16 w-16 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                    <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="font-medium">{uploadedFile.name}</span>
                      <span className="text-gray-400">
                        ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="mt-3 text-sm font-bold text-orange-600 hover:text-red-600 hover:underline transition-colors"
                      disabled={isProcessing}
                    >
                      Cambiar archivo
                    </button>
                  </div>
                ) : (
                  // Upload prompt
                  <div className="flex flex-col items-center text-center">
                    <svg
                      className="mb-4 h-16 w-16 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                    <p className="mb-2 text-base font-medium text-gray-700">
                      Arrastra y suelta un archivo de audio aquí
                    </p>
                    <p className="mb-4 text-sm text-gray-500">o</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl bg-gradient-to-r from-orange-600 to-red-600 px-6 py-3 text-sm font-black text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50"
                      disabled={isProcessing}
                    >
                      Seleccionar archivo
                    </button>
                    <p className="mt-4 text-xs text-gray-400">
                      Formatos: WAV, MP3, M4A, AAC, OGG, FLAC, WebM • Máximo 20MB
                    </p>
                  </div>
                )}
                </div>
              </>
            )}

            {/* Error Message */}
            {(error || uploadError) && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-pink-50 p-4 text-sm text-red-700 shadow-sm">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
                <span className="font-medium">{error || uploadError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t-2 border-gray-100 pt-5">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gradient-to-br hover:from-gray-50 hover:to-gray-100 transition-all disabled:opacity-50"
                disabled={isProcessing || isRecording}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={
                  activeTab === "record"
                    ? handleGenerateFromRecording
                    : handleGenerateFromFile
                }
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 px-6 py-2.5 text-sm font-black text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-60 disabled:hover:scale-100"
                disabled={
                  isProcessing ||
                  isRecording ||
                  (activeTab === "record" ? !audioBlob : !uploadedFile)
                }
              >
                {isProcessing && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" />
                )}
                {isProcessing ? "Procesando..." : "Generar Diagrama"}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
