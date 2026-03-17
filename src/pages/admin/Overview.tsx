import React from 'react';
import { Users, Utensils, Clock, DollarSign, MessageSquare, Bot } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string, icon: React.ComponentType<{ className?: string }>, color: string }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4">
    <div className={`p-4 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

export default function AdminOverview() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Platform Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Restaurants" value="124" icon={Utensils} color="bg-blue-500" />
        <StatCard title="Active Restaurants" value="98" icon={Users} color="bg-green-500" />
        <StatCard title="Trial Users" value="15" icon={Clock} color="bg-yellow-500" />
        <StatCard title="Expired Accounts" value="11" icon={Users} color="bg-red-500" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="AI Conversations Today" value="2,450" icon={Bot} color="bg-indigo-500" />
        <StatCard title="Messages Sent Today" value="12,890" icon={MessageSquare} color="bg-purple-500" />
        <StatCard title="Revenue This Month" value="₹4,50,000" icon={DollarSign} color="bg-emerald-500" />
      </div>
    </div>
  );
}
