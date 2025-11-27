import React from 'react';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r p-4">
      <div className="text-xl font-bold mb-6">LY Admin</div>
      <nav className="flex flex-col gap-2">
        <a className="px-3 py-2 rounded hover:bg-slate-100" href="/admin/dashboard">Dashboard</a>
        <a className="px-3 py-2 rounded hover:bg-slate-100" href="javascript:void(0);">Topics</a>
        <a className="px-3 py-2 rounded hover:bg-slate-100" href="javascript:void(0);">History</a>
        <a className="px-3 py-2 rounded hover:bg-slate-100" href="javascript:void(0);">Settings</a>
      </nav>
    </aside>
  );
}