import React from 'react';
import { LayoutDashboard, Utensils, Tag, History, Settings, BarChart, MessageSquare, Database } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  const baseUrl = `/admin`;

  const navItems = [
    { name: 'Overview', path: baseUrl, icon: LayoutDashboard },
    { name: 'Restaurants', path: `${baseUrl}/restaurants`, icon: Utensils },
    { name: 'Subscriptions', path: `${baseUrl}/subscriptions`, icon: Tag },
    { name: 'Activity Logs', path: `${baseUrl}/logs`, icon: History },
    { name: 'AI Usage', path: `${baseUrl}/ai-usage`, icon: BarChart },
    { name: 'Support', path: `${baseUrl}/support`, icon: MessageSquare },
    { name: 'Platform Settings', path: `${baseUrl}/settings`, icon: Settings },
    { name: 'Database', path: `${baseUrl}/database`, icon: Database },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col">
        <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-10">Dev Dashboard</div>
        <nav className="space-y-2 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === baseUrl}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
