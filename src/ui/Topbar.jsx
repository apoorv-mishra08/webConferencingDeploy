import React from 'react'


export default function Topbar(){
return (
<div className="flex items-center justify-between p-4 bg-white border-b">
<div className="font-semibold">Admin Dashboard</div>
<div className="flex items-center gap-3">
<div className="text-sm text-slate-500">Admin</div>
<button className="px-3 py-1 border rounded">Logout</button>
</div>
</div>
)
}