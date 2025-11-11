"use client";

import { useEffect, useRef, useState } from "react";
import { signout } from "~/app/actions/auth";

export default function UserMenu({ email }: { email: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const getInitials = (email: string | null) => {
    if (!email) return "U";
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggleMenu}
        className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/60 transition-all duration-200 group"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {/* Avatar con gradiente */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full blur opacity-60 group-hover:opacity-80 transition-opacity" />
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
            <span className="text-sm font-black text-white">
              {getInitials(email)}
            </span>
          </div>
        </div>
        
        {/* Email con truncado */}
        <span className="hidden sm:block max-w-[150px] truncate font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
          {email ?? "Invitado"}
        </span>
        
        {/* Chevron animado */}
        <svg 
          className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu moderno */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 animate-slideDown">
          <div className="rounded-2xl border border-white/40 bg-white/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Header del dropdown */}
            <div className="bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center shadow-lg">
                  <span className="text-lg font-black text-white">
                    {getInitials(email)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{email ?? "Invitado"}</p>
                  <p className="text-xs text-white/80 font-medium">Cuenta activa</p>
                </div>
              </div>
            </div>

            {/* Opciones del menú */}
            <div className="p-2">
              <button
                onClick={signout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-600 transition-all group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-red-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <span>Cerrar sesión</span>
                <svg className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
