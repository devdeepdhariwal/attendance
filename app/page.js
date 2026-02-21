'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const FEATURES = {
  attendance: [
    'QR-based check-in & check-out',
    'Real-time attendance tracking',
    'Session management',
    'Student roll number verification',
  ],
  certificates: [
    'Drag & drop text positioning',
    'Live canvas preview',
    'Bulk ZIP generation',
    'Custom fonts, colors & styles',
  ],
};

export default function Home() {
  const router  = useRouter();
  const [hovered,         setHovered]         = useState(null);
  const [loggingOut,      setLoggingOut]       = useState(false);
  const [showLogoutModal, setShowLogoutModal]  = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">

      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Logout confirm modal ─────────────────────────────────────── */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogoutModal(false)} />
          <div className="relative bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-10 h-10 bg-red-500/15 border border-red-500/30 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-base mb-1">Sign out?</h3>
            <p className="text-slate-400 text-sm mb-6">You'll need to sign in again to access the portal.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loggingOut
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing out...</>
                  : 'Sign Out'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/30">
            C
          </div>
          <span className="text-white font-semibold text-sm tracking-wide">
            CyberPhoenix Club
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">System Online</span>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs border border-white/10 hover:border-white/20 hover:bg-white/5 px-3 py-1.5 rounded-lg transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span className="text-indigo-300 text-xs font-medium tracking-widest uppercase">
            Department of Computer Science & Engineering
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-white text-center leading-tight mb-4 max-w-3xl">
          Event Management
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
            Portal
          </span>
        </h1>

        <p className="text-slate-400 text-center text-base md:text-lg max-w-xl mb-14 leading-relaxed">
          Manage attendance with QR codes and generate personalized certificates — all in one place.
        </p>

        {/* ── Two cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">

          {/* Attendance Card */}
          <button
            onClick={() => router.push('/admin')}
            onMouseEnter={() => setHovered('attendance')}
            onMouseLeave={() => setHovered(null)}
            className="group relative bg-white/5 hover:bg-white/8 border border-white/10 hover:border-indigo-500/50 rounded-2xl p-7 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
          >
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600/10 to-transparent transition-opacity duration-300 ${hovered === 'attendance' ? 'opacity-100' : 'opacity-0'}`} />
            <div className="relative">
              <div className="w-12 h-12 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center mb-5 group-hover:bg-indigo-500/25 transition-colors">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-2.25z" />
                </svg>
              </div>
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-xl font-bold text-white">Attendance</h2>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full font-medium">
                  QR Based
                </span>
              </div>
              <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                Create sessions, generate QR codes, and track student check-in and check-out in real time.
              </p>
              <ul className="space-y-2 mb-6">
                {FEATURES.attendance.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold group-hover:gap-3 transition-all">
                Open Dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </button>

          {/* Certificates Card */}
          <button
            onClick={() => router.push('/certificates')}
            onMouseEnter={() => setHovered('certificates')}
            onMouseLeave={() => setHovered(null)}
            className="group relative bg-white/5 hover:bg-white/8 border border-white/10 hover:border-violet-500/50 rounded-2xl p-7 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/10 hover:-translate-y-1"
          >
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600/10 to-transparent transition-opacity duration-300 ${hovered === 'certificates' ? 'opacity-100' : 'opacity-0'}`} />
            <div className="relative">
              <div className="w-12 h-12 bg-violet-500/15 border border-violet-500/30 rounded-xl flex items-center justify-center mb-5 group-hover:bg-violet-500/25 transition-colors">
                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-xl font-bold text-white">Certificates</h2>
                <span className="text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2.5 py-1 rounded-full font-medium">
                  Bulk Export
                </span>
              </div>
              <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                Upload a template, position text visually, and generate personalized certificates for all attendees.
              </p>
              <ul className="space-y-2 mb-6">
                {FEATURES.certificates.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="w-4 h-4 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-violet-400 text-sm font-semibold group-hover:gap-3 transition-all">
                Generate Certificates
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </button>

        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-8 mt-14 flex-wrap justify-center">
          {[
            { label: 'University', value: 'GJUS&T'       },
            { label: 'Department', value: 'CSE'          },
            { label: 'Club',       value: 'CyberPhoenix' },
            { label: 'System',     value: 'v1.0'         },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-white font-bold text-sm">{value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-8 py-4 flex items-center justify-between flex-wrap gap-3">
        <p className="text-slate-600 text-xs">
          © 2026 CyberPhoenix Club · Guru Jambheshwar University of Science & Technology
        </p>
        <p className="text-slate-600 text-xs">
          Built for <span className="text-indigo-500">Manipulation Matrix</span> · GJUS&T Hisar
        </p>
      </footer>

    </div>
  );
}
