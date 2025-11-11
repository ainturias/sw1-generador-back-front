"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import UserMenu from "~/components/dashboard/UserMenu";
import CreateRoom from "~/components/dashboard/CreateRoom";
import RoomsView from "~/components/dashboard/RoomsView";

export default async function Page() {
  const session = await auth();

  const user = await db.user.findUniqueOrThrow({
    where: {
      id: session?.user.id,
    },
    include: {
      ownedRooms: true,
      roomInvites: {
        include: {
          room: true,
        },
      },
    },
  });

return (
  <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50">
    {/* Header minimalista flotante */}
    <header className="flex-shrink-0 sticky top-0 z-50 backdrop-blur-xl bg-white/60 border-b border-white/20 shadow-lg shadow-slate-100/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo y título con efecto gradiente */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-slate-600 to-blue-600 rounded-2xl blur-lg opacity-60 animate-pulse" />
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-700 via-slate-600 to-blue-700 flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform">
                <span className="text-2xl font-black text-white">F</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-slate-700 via-slate-600 to-blue-700 bg-clip-text text-transparent">
                Proyectos
              </h1>
              <p className="text-sm text-gray-500 font-medium">Gestiona tus diseños</p>
            </div>
          </div>

          {/* User menu con efecto glass */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 shadow-lg">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-gray-700">Conectado</span>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-white/80 backdrop-blur-sm border border-white/40 shadow-lg hover:shadow-xl transition-shadow">
              <UserMenu email={user.email} />
            </div>
          </div>
        </div>
      </div>
    </header>

    {/* Contenido principal */}
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero section con acción principal */}
      <div className="mb-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-700 via-slate-600 to-blue-700 p-8 sm:p-12 shadow-2xl">
          {/* Efectos decorativos */}
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          
          <div className="relative z-10">
            <CreateRoom />
          </div>
        </div>
      </div>

      {/* Sección de proyectos con diseño moderno */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Tus espacios de trabajo</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            <span className="font-medium">{user.ownedRooms.length + user.roomInvites.length} proyectos</span>
          </div>
        </div>
        
        <div className="rounded-3xl bg-white/80 backdrop-blur-sm border border-white/40 shadow-xl p-6 sm:p-8 hover:shadow-2xl transition-all duration-300">
          <RoomsView
            ownedRooms={user.ownedRooms}
            roomInvites={user.roomInvites.map((x) => x.room)}
          />
        </div>
      </div>

        {/* Footer decorativo */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-400 font-medium">
            ✨ Diseña. Colabora. Crea algo increíble.
          </p>
        </div>
      </div>
    </main>
  </div>
);


}

























































// "use server";

// import { auth } from "~/server/auth";
// import { db } from "~/server/db";
// import UserMenu from "~/components/dashboard/UserMenu";
// import CreateRoom from "~/components/dashboard/CreateRoom";
// import RoomsView from "~/components/dashboard/RoomsView";

// export default async function Page() {
//   const session = await auth();

//   const user = await db.user.findUniqueOrThrow({
//     where: {
//       id: session?.user.id,
//     },
//     include: {
//       ownedRooms: true,
//       roomInvites: {
//         include: {
//           room: true,
//         },
//       },
//     },
//   });

//   return (
//     <div className="flex h-screen bg-gray-50">
//       {/* Sidebar */}
//       <aside className="hidden md:flex w-20 flex-col items-center bg-white border-r border-gray-200 shadow-sm py-4">
//         <div className="mb-4">
//           {/* Puedes usar un logo o ícono aquí */}
//           <div className="h-10 w-10 bg-sky-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
//             F
//           </div>
//         </div>
//         <nav className="space-y-6 mt-8 text-gray-500">
//           <button className="hover:text-sky-500 transition-colors">
//             <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
//               <path d="M3 12h18M3 6h18M3 18h18" />
//             </svg>
//           </button>
//           {/* Otros iconos de navegación aquí */}
//         </nav>
//         <div className="mt-auto mb-4">
//           <UserMenu email={user.email} />
//         </div>
//       </aside>

//       {/* Main content */}
//       <main className="flex flex-1 flex-col">
//         {/* Header */}
//         <header className="flex items-center justify-between h-16 bg-white border-b border-gray-200 px-6 shadow-sm">
//           <h1 className="text-xl font-semibold text-gray-800">Proyectos</h1>
//           <UserMenu email={user.email} />
//         </header>

//         {/* Content */}
//         <section className="flex-1 overflow-y-auto p-6 bg-gray-50">
//           <div className="max-w-4xl mx-auto space-y-6">
//             <div>
//               <CreateRoom />
//             </div>
//             <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
//               <RoomsView
//                 ownedRooms={user.ownedRooms}
//                 roomInvites={user.roomInvites.map((x) => x.room)}
//               />
//             </div>
//           </div>
//         </section>
//       </main>
//     </div>
//   );
// }
