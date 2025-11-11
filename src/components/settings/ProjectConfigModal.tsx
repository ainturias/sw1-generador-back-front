"use client";

import { useEffect, useState } from "react";
import type { ProjectConfig } from "~/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ProjectConfig) => void;
  initialConfig?: ProjectConfig;
};

const defaultConfig: ProjectConfig = {
  projectName: "mi-proyecto",
  description: "",
  groupId: "com.ejemplo.proyecto",
  artifactId: "mi-proyecto",
  version: "1.0.0",
  javaVersion: "17",
  springBootVersion: "3.2.0",
  packaging: "jar",
  database: "postgresql",
  databaseName: "mi_proyecto_db",
  databaseHost: "localhost",
  databasePort: 5432,
  databaseUsername: "postgres",
  databasePassword: "password",
  serverPort: 8080,
  contextPath: "/api",
  flutterEnabled: false,
  flutterVersion: "3.16.0",
  flutterPackageName: "com.ejemplo.proyecto_app",
  flutterBaseUrl: "http://localhost:8080/api",
};

const ProjectConfigModal = ({ isOpen, onClose, onSave, initialConfig }: Props) => {
  const [config, setConfig] = useState<ProjectConfig>(initialConfig ?? defaultConfig);

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  // Escape key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      {/* Gradient border wrapper */}
      <div
        className="w-full max-w-3xl bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 p-[2px] rounded-3xl shadow-2xl my-8 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-[22px] bg-white">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-6 py-6 rounded-t-[22px] bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700">
              <h2 id="modal-title" className="text-2xl font-black text-white flex items-center gap-2">
                <span className="text-3xl">⚙️</span>
                Configuración del Proyecto
              </h2>
              <p className="mt-2 text-sm text-white/90 font-medium">
                Configura los parámetros para la generación de código Spring Boot y Flutter
              </p>
            </div>

          {/* Content */}
          <div className="max-h-[70vh] overflow-y-auto scrollbar-hide px-6 py-6">
            <div className="space-y-6">
              {/* Información Básica */}
              <section>
                <div className="mb-4 pb-3 border-b-2 border-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
                  <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700">
                    📋 INFORMACIÓN BÁSICA
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Nombre del Proyecto *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.projectName}
                      onChange={(e) => setConfig({ ...config, projectName: e.target.value })}
                      placeholder="mi-proyecto-erp"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Descripción
                    </label>
                    <textarea
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300 resize-none"
                      value={config.description ?? ""}
                      onChange={(e) => setConfig({ ...config, description: e.target.value })}
                      placeholder="Sistema de gestión empresarial..."
                      rows={2}
                    />
                  </div>
                </div>
              </section>

              {/* Configuración Java/Spring Boot */}
              <section>
                <div className="mb-4 pb-3 border-b-2 border-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
                  <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700">
                    ☕ CONFIGURACIÓN JAVA/SPRING BOOT
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Group ID *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.groupId}
                      onChange={(e) => setConfig({ ...config, groupId: e.target.value })}
                      placeholder="com.ejemplo.proyecto"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Artifact ID *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.artifactId}
                      onChange={(e) => setConfig({ ...config, artifactId: e.target.value })}
                      placeholder="mi-proyecto"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Versión *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.version}
                      onChange={(e) => setConfig({ ...config, version: e.target.value })}
                      placeholder="1.0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Versión de Java *
                    </label>
                    <select
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300 bg-white cursor-pointer"
                      value={config.javaVersion}
                      onChange={(e) => setConfig({ ...config, javaVersion: e.target.value })}
                    >
                      <option value="11">Java 11</option>
                      <option value="17">Java 17</option>
                      <option value="21">Java 21</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Versión de Spring Boot *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.springBootVersion}
                      onChange={(e) => setConfig({ ...config, springBootVersion: e.target.value })}
                      placeholder="3.2.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Empaquetado *
                    </label>
                    <select
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300 bg-white cursor-pointer"
                      value={config.packaging}
                      onChange={(e) => setConfig({ ...config, packaging: e.target.value as "jar" | "war" })}
                    >
                      <option value="jar">JAR</option>
                      <option value="war">WAR</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Base de Datos */}
              <section>
                <div className="mb-4 pb-3 border-b-2 border-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
                  <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700">
                    🗄️ BASE DE DATOS
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Tipo de Base de Datos *
                    </label>
                    <select
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300 bg-white cursor-pointer"
                      value={config.database}
                      onChange={(e) => setConfig({ ...config, database: e.target.value as ProjectConfig["database"] })}
                    >
                      <option value="mysql">MySQL</option>
                      <option value="postgresql">PostgreSQL</option>
                      <option value="h2">H2 (En memoria)</option>
                      <option value="oracle">Oracle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Nombre de la Base de Datos
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.databaseName ?? ""}
                      onChange={(e) => setConfig({ ...config, databaseName: e.target.value })}
                      placeholder="mi_proyecto_db"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Host *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.databaseHost ?? "localhost"}
                      onChange={(e) => setConfig({ ...config, databaseHost: e.target.value })}
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Puerto *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.databasePort ?? 5432}
                      onChange={(e) => setConfig({ ...config, databasePort: parseInt(e.target.value) || 5432 })}
                      placeholder="5432"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Usuario *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.databaseUsername ?? ""}
                      onChange={(e) => setConfig({ ...config, databaseUsername: e.target.value })}
                      placeholder="postgres"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.databasePassword ?? ""}
                      onChange={(e) => setConfig({ ...config, databasePassword: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </section>

              {/* Servidor */}
              <section>
                <div className="mb-4 pb-3 border-b-2 border-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
                  <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700">
                    🌐 SERVIDOR
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Puerto del Servidor *
                    </label>
                    <input
                      type="number"
                      required
                      min="1024"
                      max="65535"
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.serverPort}
                      onChange={(e) => setConfig({ ...config, serverPort: parseInt(e.target.value) })}
                      placeholder="8080"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Context Path
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                      value={config.contextPath ?? ""}
                      onChange={(e) => setConfig({ ...config, contextPath: e.target.value })}
                      placeholder="/api"
                    />
                  </div>
                </div>
              </section>

              {/* Flutter (Opcional) */}
              <section>
                <div className="mb-4 pb-3 border-b-2 border-gradient-to-r from-purple-400 via-pink-400 to-blue-400 flex items-center justify-between">
                  <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700">
                    📱 FLUTTER (OPCIONAL)
                  </h3>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.flutterEnabled}
                      onChange={(e) => setConfig({ ...config, flutterEnabled: e.target.checked })}
                    />
                    <div className="relative w-12 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-slate-700 peer-checked:via-slate-600 peer-checked:to-blue-700"></div>
                  </label>
                </div>
                {config.flutterEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slideDown">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Versión de Flutter
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                        value={config.flutterVersion ?? ""}
                        onChange={(e) => setConfig({ ...config, flutterVersion: e.target.value })}
                        placeholder="3.16.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Nombre del Paquete Flutter
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                        value={config.flutterPackageName ?? ""}
                        onChange={(e) => setConfig({ ...config, flutterPackageName: e.target.value })}
                        placeholder="com.ejemplo.proyecto_app"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Base URL del API *
                        <span className="ml-2 text-xs text-gray-500 font-normal">
                          (URL del backend para Flutter)
                        </span>
                      </label>
                      <input
                        type="url"
                        required={config.flutterEnabled}
                        className="w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-4 focus:ring-slate-100 outline-none transition-all duration-200 hover:border-slate-300"
                        value={config.flutterBaseUrl ?? ""}
                        onChange={(e) => setConfig({ ...config, flutterBaseUrl: e.target.value })}
                        placeholder="http://localhost:8080/api"
                      />
                      <p className="mt-2 text-xs text-gray-600 flex items-start gap-1">
                        <span>💡</span>
                        <span>
                          Ejemplos: <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">http://localhost:8080/api</code>, 
                          <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 ml-1">http://192.168.1.5:8080/api</code>, 
                          <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 ml-1">https://api.miapp.com</code>
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-b-[22px] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-6 py-2.5 text-sm font-bold text-gray-700 bg-white border-2 border-gray-300 hover:border-gray-400 hover:shadow-lg hover:scale-105 transition-all duration-200 active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 px-6 py-2.5 text-sm font-bold text-white hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95"
            >
              💾 Guardar Configuración
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default ProjectConfigModal;
