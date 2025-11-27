import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'


export default function AdminLogin(){
const [form, setForm] = useState({ username: '', password: '' })
const navigate = useNavigate()


async function submit(){
const res = await fetch('http://localhost:3000/api/admin-login', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
if(res.ok) navigate('/admin/dashboard')
else alert('invalid credentials')
}


return (
<div className="min-h-screen flex items-center justify-center bg-slate-50">
<div className="bg-white p-8 rounded-2xl shadow-lg w-[520px]">
<h2 className="text-2xl font-bold mb-4">Admin Login</h2>
<input className="w-full border px-4 py-2 rounded mb-3" placeholder="Username" value={form.username} onChange={e=>setForm({...form, username: e.target.value})} />
<input type="password" className="w-full border px-4 py-2 rounded mb-4" placeholder="Password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} />
<div className="flex gap-3">
<button onClick={submit} className="bg-indigo-600 text-white px-4 py-2 rounded">Login</button>
<a href="/" className="text-sm text-slate-500 self-center">Back to Home</a>
</div>
</div>
</div>
)
}