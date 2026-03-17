import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Lock, User, ShieldCheck, ChefHat, Receipt } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.role, data.restaurant_id);
        if (data.role === 'admin') navigate(`/admin`);
        else if (data.role === 'kitchen') navigate('/kitchen');
        else if (data.role === 'billing') navigate('/billing');
      } else {
        setError(data.error);
      }
    } catch {
      setError('Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-800"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">System Access</h1>
          <p className="text-slate-400">Admin, Kitchen & Billing</p>
        </div>

        {error && (
          <div className="bg-red-900/30 text-red-400 p-3 rounded-lg mb-4 text-sm text-center border border-red-900/50">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                placeholder="username"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                placeholder="password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Sign In
          </button>
        </form>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs text-slate-500">
          <div className="flex flex-col items-center gap-1">
            <ShieldCheck className="w-5 h-5" />
            <span>Admin</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ChefHat className="w-5 h-5" />
            <span>Kitchen</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Receipt className="w-5 h-5" />
            <span>Billing</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
