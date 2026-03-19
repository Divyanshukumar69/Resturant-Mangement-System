import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { AddTableModal } from '../components/AddTableModal';
import QRCode from 'qrcode';
import { Download, Edit, Plus, Tag, ToggleLeft, ToggleRight, Star, Clock, Lock, History, Store, UserCog, Check, LayoutDashboard, UtensilsCrossed, Percent, Settings, Table as TableIcon, X, Upload, Wand2, Loader2, Trash2, LogOut, Sparkles } from 'lucide-react';
import { Table, MenuItem, Discount, Order } from '../types';
import { GoogleGenAI } from "@google/genai";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SuccessPopup = ({ message, onClose }: { message: string, onClose: () => void }) => (
  <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-slate-100 dark:border-slate-700">
      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 shadow-sm">
        <Check className="w-8 h-8 text-green-600 dark:text-green-400" strokeWidth={3} />
      </div>
      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Success!</h3>
      <p className="text-slate-600 dark:text-slate-300 mb-8 text-center font-medium">{message}</p>
      <button 
        onClick={onClose}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
      >
        Okay, Great!
      </button>
    </div>
  </div>
);

const AddMenuItemModal = ({ onClose, onSave, token, initialData }: { onClose: () => void, onSave: () => void, token: string | null, initialData?: MenuItem | null }) => {
  const [formData, setFormData] = useState({
    id: initialData?.id || undefined,
    name: initialData?.name || '',
    category_name: initialData?.category_name || '',
    price: initialData?.price ? String(initialData?.price) : '',
    description: initialData?.description || '',
    image_url: initialData?.image_url || ''
  });
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(initialData?.image_url || null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setPreviewImage(base64String);
      setFormData(prev => ({ ...prev, image_url: base64String }));
      
      // AI Extraction
      if (process.env.GEMINI_API_KEY) {
        setAiLoading(true);
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          
          const prompt = "Analyze this image. If it's a food item, extract its likely name, a short appetizing description, a category (e.g., Starter, Main Course, Dessert, Beverage), and an estimated price in INR (just the number). Return ONLY a JSON object with keys: name, description, category_name, price.";
          
          const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      data: base64String.split(',')[1],
                      mimeType: file.type
                    }
                  }
                ]
              }
            ]
          });
          
          const text = response.text;
          
          try {
            if (text) {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                setFormData(prev => ({
                  ...prev,
                  name: data.name || prev.name,
                  description: data.description || prev.description,
                  category_name: data.category_name || prev.category_name,
                  price: data.price ? String(data.price) : prev.price,
                  image_url: base64String // Ensure image is kept
                }));
              }
            }
          } catch (e) {
            console.error("Failed to parse AI response", e);
          }
        } catch (err) {
          console.error("AI Error", err);
        } finally {
          setAiLoading(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/menu/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        onSave();
        if (formData.id) {
          onClose();
        } else {
          // Clear form to allow adding next item as requested
          setFormData({
            id: undefined,
            name: '',
            category_name: '',
            price: '',
            description: '',
            image_url: ''
          });
          setPreviewImage(null);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">{formData.id ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div className="flex flex-col items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative overflow-hidden group">
                {previewImage ? (
                  <>
                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white font-bold flex items-center gap-2"><Upload className="w-4 h-4" /> Change Image</p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="mb-2 text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG (MAX. 2MB)</p>
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
              {aiLoading && (
                <div className="mt-2 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium animate-pulse">
                  <Wand2 className="w-4 h-4" /> AI is analyzing image...
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Item Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                placeholder="e.g. Butter Chicken"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={formData.category_name}
                  onChange={e => setFormData({...formData, category_name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder="e.g. Main Course"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Price (₹)</label>
                <input
                  type="number"
                  required
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder="250"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                placeholder="Describe the dish..."
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || aiLoading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (formData.id ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />)}
              {formData.id ? 'Save Changes' : 'Add Item'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

type TabId = 'tables' | 'menu' | 'discounts' | 'history' | 'settings' | 'marketing' | 'analytics';

export default function AdminDashboard() {
  const { token, restaurantId, logout } = useAuth();
  const socket = useSocket();
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [stats, setStats] = useState({ activeOrders: 0, todaySales: 0 });
  const [newDiscountCode, setNewDiscountCode] = useState('');
  const [newDiscountPercent, setNewDiscountPercent] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('tables');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<{ id: number; name: string } | null>(null);
  const [editTableName, setEditTableName] = useState('');
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);

  const fetchTables = useCallback(async () => {
    if (!token) return;
    const res = await fetch('/api/admin/tables', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setTables(data);
  }, [token]);

  const handleAddTable = async (name: string) => {
    await fetch('/api/admin/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ restaurantId, name })
    });
    setShowAddTableModal(false);
  };

  const handleEditTable = async () => {
    if (!editingTable || !editTableName.trim()) return;
    await fetch(`/api/admin/tables/${editingTable.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: editTableName.trim() })
    });
    setEditingTable(null);
    fetchTables();
  };

  const handleDeleteTable = async (tableId: number, tableName: string) => {
    if (!confirm(`Delete table "${tableName}"? This will also remove all related orders.`)) return;
    await fetch(`/api/admin/tables/${tableId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchTables();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTables();
    }, 0);
    if (socket) {
      socket.on('table:updated', fetchTables);
      return () => {
        clearTimeout(timer);
        socket.off('table:updated', fetchTables);
      };
    }
    return () => {
      clearTimeout(timer);
    };
  }, [socket, fetchTables]);

  // Marketing State
  const [customers, setCustomers] = useState<{id: number, name: string, phone: string, created_at: string, source: string}[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<number>>(new Set());
  const [bulkMessage, setBulkMessage] = useState('Hi {{name}} 👋\nThanks for visiting our restaurant!\n\n🎁 Here is your special offer:\n20% OFF on your next order.\n\nShow this message at the counter.');

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<{todayRevenue: number, topItems: {name: string, count: number}[], dailySales: {date: string, total: number}[]} | null>(null);

  // History State
  const [historyRange, setHistoryRange] = useState('7d');
  const [historyData, setHistoryData] = useState<{orders: Order[], totalSales: number, totalOrders: number}>({ orders: [], totalSales: 0, totalOrders: 0 });

  // Settings State
  const [shopSettings, setShopSettings] = useState({ is_open: 1, opening_hours: '', ai_prompt: '', ai_api_key: '' });
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [userUpdate, setUserUpdate] = useState({ role: 'kitchen', username: '', password: '' });

  const fetchStats = useCallback(() => {
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setStats(data));
  }, [token]);

  const fetchHistory = useCallback(() => {
    fetch(`/api/admin/history?range=${historyRange}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setHistoryData(data));
  }, [token, historyRange]);

  const fetchShopSettings = useCallback(() => {
    fetch('/api/admin/shop/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setShopSettings({ is_open: data.is_open, opening_hours: data.opening_hours, ai_prompt: data.ai_prompt || '', ai_api_key: data.ai_api_key || '' });
        if (data.opening_hours) {
          const parts = data.opening_hours.split(' - ');
          if (parts.length === 2) {
            setOpenTime(parts[0]);
            setCloseTime(parts[1]);
          }
        }
      });
  }, [token]);

  useEffect(() => {
    fetchStats();
    
    if (activeTab === 'tables') {
      fetch('/api/admin/tables', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setTables(data));
    } else if (activeTab === 'menu') {
      fetch('/api/admin/menu', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setMenuItems(data));
    } else if (activeTab === 'discounts') {
      fetch('/api/admin/discounts', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setDiscounts(data));
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'settings') {
      fetchShopSettings();
    } else if (activeTab === 'marketing') {
      fetch('/api/admin/customers', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setCustomers(data));
    } else if (activeTab === 'analytics') {
      fetch('/api/admin/analytics', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setAnalyticsData(data));
    }
  }, [token, activeTab, fetchHistory, fetchShopSettings, fetchStats]);

  useEffect(() => {
    if (!socket || !restaurantId) return;

    socket.emit('join_restaurant', restaurantId);

    const handleUpdate = () => {
      fetchStats();
      if (activeTab === 'tables') {
        fetch('/api/staff/tables', { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.json())
          .then(data => setTables(data));
      }
      if (activeTab === 'history') fetchHistory();
    };

    socket.on('new_order', handleUpdate);
    socket.on('order_updated', handleUpdate);
    socket.on('order_paid', handleUpdate);
    socket.on('table:updated', handleUpdate);
    socket.on('menu:updated', () => {
      if (activeTab === 'menu') {
        fetch('/api/admin/menu', { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.json())
          .then(data => setMenuItems(data));
      }
    });

    return () => {
      socket.off('new_order', handleUpdate);
      socket.off('order_updated', handleUpdate);
      socket.off('order_paid', handleUpdate);
      socket.off('table:updated', handleUpdate);
      socket.off('menu:updated');
    };
  }, [socket, restaurantId, token, activeTab, fetchStats, fetchHistory]);

  const createDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscountCode || !newDiscountPercent) return;

    const res = await fetch('/api/admin/discount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: newDiscountCode, percentage: Number(newDiscountPercent) }),
    });

    if (res.ok) {
      setNewDiscountCode('');
      setNewDiscountPercent('');
      fetch('/api/admin/discounts', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setDiscounts(data));
    }
  };

  const downloadQR = async (table: Table) => {
    // Standardized production QR URL: /table/:tableId
    // The backend handles the redirect to /s/:token automatically
    const url = `${window.location.origin}/table/${table.id}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300 });
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-Table-${table.name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleItemAvailability = async (itemId: number, currentStatus: number) => {
    await fetch('/api/admin/menu/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId, isAvailable: !currentStatus }),
    });
    setMenuItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: currentStatus ? 0 : 1 } : i));
  };

  const toggleItemSpecial = async (itemId: number, currentStatus: number) => {
    await fetch('/api/admin/menu/special', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId, isSpecial: !currentStatus }),
    });
    setMenuItems(prev => prev.map(i => i.id === itemId ? { ...i, is_special: currentStatus ? 0 : 1 } : i));
  };

  const handleDeleteMenuItem = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}" from menu?`)) return;
    try {
      const res = await fetch(`/api/admin/menu/item/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMenuItems(prev => prev.filter(i => i.id !== id));
        setSuccessMessage(`Deleted ${name} from menu`);
      } else {
        const data = await res.json();
        alert(`Failed to delete: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Failed to connect to server');
    }
  };

  const updateShopSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullHours = `${openTime} - ${closeTime}`;
    await fetch('/api/admin/shop/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        isOpen: shopSettings.is_open, 
        openingHours: fullHours, 
        aiPrompt: shopSettings.ai_prompt,
        aiApiKey: shopSettings.ai_api_key 
      }),
    });
    setSuccessMessage('Shop settings have been updated successfully.');
  };

  const updateUserCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUpdate.username || !userUpdate.password) return;
    
    const res = await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        targetRole: userUpdate.role, 
        newUsername: userUpdate.username, 
        newPassword: userUpdate.password 
      }),
    });
    
    if (res.ok) {
      setSuccessMessage(`Credentials for ${userUpdate.role} updated successfully.`);
      setUserUpdate({ ...userUpdate, username: '', password: '' });
    } else {
      alert('Failed to update credentials');
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'tables', label: 'Tables', icon: TableIcon },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'discounts', label: 'Discounts', icon: Percent },
    { id: 'history', label: 'History', icon: History },
    { id: 'marketing', label: 'Marketing', icon: Store },
    { id: 'analytics', label: 'Analytics', icon: LayoutDashboard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {successMessage && (
        <SuccessPopup message={successMessage} onClose={() => setSuccessMessage('')} />
      )}
      
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-40 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 group">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-transform group-hover:rotate-12 duration-300">
              <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white tracking-tight uppercase">Admin Dashboard</h1>
          </div>
          
          <div className="w-full max-w-2xl">
            <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-1 shadow-inner overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 min-w-max px-0.5">
                {tabs.map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                      activeTab === tab.id 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md scale-100 ring-2 ring-indigo-500/10' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeTab === tab.id ? 'fill-indigo-500/10' : ''}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto">

      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 col-span-full md:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Table QR Codes</h2>
              <button 
                onClick={() => setShowAddTableModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Table
              </button>
            </div>
            <div className="space-y-3">
              {tables.length === 0 && (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                  <TableIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No tables yet</p>
                  <p className="text-sm">Click "Add Table" to create your first table</p>
                </div>
              )}
              {tables.map(table => (
                <div key={table.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{table.name}</p>
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      table.status === 'occupied'
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    }`}>{table.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadQR(table)}
                      className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-2 rounded-xl transition-colors"
                      title="Download QR"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setEditingTable({ id: table.id, name: table.name }); setEditTableName(table.name); }}
                      className="text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 p-2 rounded-xl transition-colors"
                      title="Edit table name"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTable(table.id, table.name)}
                      className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-xl transition-colors"
                      title="Delete table"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {showAddTableModal && (
            <AddTableModal 
              onClose={() => setShowAddTableModal(false)}
              onSave={handleAddTable}
            />
          )}

          {/* Edit Table Modal */}
          {editingTable && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Rename Table</h3>
                  <button onClick={() => setEditingTable(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={editTableName}
                  onChange={e => setEditTableName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEditTable()}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white mb-4"
                  placeholder="Table name"
                />
                <div className="flex gap-3">
                  <button onClick={() => setEditingTable(null)} className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleEditTable} disabled={!editTableName.trim()} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Quick Stats</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                <p className="text-indigo-600 dark:text-indigo-400 text-sm font-bold uppercase tracking-wider mb-1">Today's Sales</p>
                <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">₹{stats.todaySales.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-xl border border-green-100 dark:border-green-800/50">
                <p className="text-green-600 dark:text-green-400 text-sm font-bold uppercase tracking-wider mb-1">Active Orders</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100">{stats.activeOrders}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'menu' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Menu Items</h2>
            <button 
              onClick={() => setShowAddMenuModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm uppercase tracking-wider">Image</th>
                  <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm uppercase tracking-wider">Name</th>
                  <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm uppercase tracking-wider">Category</th>
                  <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm uppercase tracking-wider">Price</th>
                  <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm uppercase tracking-wider">Status</th>
                  <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm uppercase tracking-wider">Special</th>
                  <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {menuItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
                        <img 
                          src={item.image_url || `https://picsum.photos/seed/${item.id}/200`} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-900 dark:text-white">{item.name}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{item.category_name}</td>
                    <td className="p-4 font-bold text-slate-900 dark:text-white">₹{item.price}</td>
                    <td className="p-4">
                      <button 
                        onClick={() => toggleItemAvailability(item.id, item.is_available)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                          item.is_available 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {item.is_available ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        {item.is_available ? 'AVAILABLE' : 'UNAVAILABLE'}
                      </button>
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => toggleItemSpecial(item.id, item.is_special)}
                        className={`p-2 rounded-full transition-all ${
                          item.is_special 
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' 
                            : 'text-slate-300 dark:text-slate-600 hover:text-yellow-400 dark:hover:text-yellow-400'
                        }`}
                        title="Toggle Today's Special"
                      >
                        <Star className={`w-5 h-5 ${item.is_special ? 'fill-current' : ''}`} />
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setEditingMenuItem(item); setShowAddMenuModal(true); }}
                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 transition-colors"
                          title="Edit Item"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteMenuItem(item.id, item.name)}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddMenuModal && (
        <AddMenuItemModal 
          onClose={() => {
            setShowAddMenuModal(false);
            setEditingMenuItem(null);
          }}
          onSave={() => {
            fetch('/api/admin/menu', { headers: { Authorization: `Bearer ${token}` } })
              .then(res => res.json())
              .then(data => setMenuItems(data));
            setSuccessMessage(editingMenuItem ? 'Menu item updated!' : 'Menu item added!');
          }}
          token={token}
          initialData={editingMenuItem}
        />
      )}

      {activeTab === 'discounts' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">Discount Codes</h2>
          
          <form onSubmit={createDiscount} className="flex gap-4 mb-8 items-end">
            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Code</label>
              <input
                type="text"
                value={newDiscountCode}
                onChange={(e) => setNewDiscountCode(e.target.value.toUpperCase())}
                placeholder="SUMMER20"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors"
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Percentage</label>
              <input
                type="number"
                value={newDiscountPercent}
                onChange={(e) => setNewDiscountPercent(e.target.value)}
                placeholder="20"
                min="1"
                max="100"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors"
              />
            </div>
            <button 
              type="submit"
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              Create
            </button>
          </form>

          <div className="space-y-3">
            {discounts.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Tag className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No active discounts</p>
              </div>
            ) : (
              discounts.map(discount => (
                <div key={discount.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                      <Tag className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white text-lg">{discount.code}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{discount.percentage}% Off</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    discount.is_active 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {discount.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Sales History</h2>
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1.5">
                {['7d', '14d', '30d', '6m', '1y'].map(range => (
                  <button
                    key={range}
                    onClick={() => setHistoryRange(range)}
                    className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${
                      historyRange === range 
                        ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-white' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                <p className="text-indigo-600 dark:text-indigo-400 text-sm font-bold uppercase tracking-wider mb-2">Total Revenue</p>
                <p className="text-4xl font-bold text-indigo-900 dark:text-indigo-100">₹{historyData.totalSales.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                <p className="text-blue-600 dark:text-blue-400 text-sm font-bold uppercase tracking-wider mb-2">Total Orders</p>
                <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">{historyData.totalOrders}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Order ID</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Date</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Customer</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {historyData.orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="p-4 font-mono font-medium text-slate-500 dark:text-slate-400">#{order.id}</td>
                      <td className="p-4 text-slate-700 dark:text-slate-300">{new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}</td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{order.customer_nickname || '-'}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">₹{order.total_amount}</td>
                    </tr>
                  ))}
                  {historyData.orders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-400 dark:text-slate-500">No orders found for this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'marketing' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Marketing & Campaigns</h2>
              <a 
                href={`/landing/${restaurantId}`} 
                target="_blank" 
                rel="noreferrer"
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                <Store className="w-4 h-4" /> View Landing Page
              </a>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 mb-8">
              <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-2">WhatsApp Marketing</h3>
              <p className="text-indigo-700 dark:text-indigo-300 mb-4">
                Send bulk WhatsApp messages to your customers with special discounts and offers.
              </p>
              <div className="flex flex-col gap-4">
                <textarea 
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  className="w-full p-4 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                  rows={4}
                />
                <button 
                  onClick={() => {
                    if (selectedCustomers.size === 0) {
                      alert("Please select at least one customer.");
                      return;
                    }
                    alert(`Sending WhatsApp message to ${selectedCustomers.size} customers...`);
                    // In a real app, this would call an API to send messages via Twilio/WhatsApp Cloud API
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-green-200 dark:shadow-none flex items-center justify-center gap-2 w-full md:w-auto self-start"
                >
                  Send to {selectedCustomers.size} Customers
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      <input 
                        type="checkbox" 
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCustomers(new Set(customers.map(c => c.id)));
                          } else {
                            setSelectedCustomers(new Set());
                          }
                        }}
                        checked={customers.length > 0 && selectedCustomers.size === customers.length}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Customer Name</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Phone Number</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Date Registered</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {customers.map(customer => (
                    <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          checked={selectedCustomers.has(customer.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedCustomers);
                            if (e.target.checked) newSet.add(customer.id);
                            else newSet.delete(customer.id);
                            setSelectedCustomers(newSet);
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-4 font-medium text-slate-800 dark:text-white">{customer.name}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{customer.phone}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{new Date(customer.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md text-xs font-bold">
                          {customer.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 dark:text-slate-500">
                        No customer data available yet. Share your landing page to collect leads!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && analyticsData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-500 dark:text-slate-400 font-medium mb-2">Today's Revenue</h3>
              <p className="text-4xl font-bold text-slate-800 dark:text-white">₹{analyticsData.todayRevenue}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-500 dark:text-slate-400 font-medium mb-2">Top Item Today</h3>
              <p className="text-2xl font-bold text-slate-800 dark:text-white truncate">
                {analyticsData.topItems?.[0]?.name || 'N/A'}
              </p>
              <p className="text-sm text-indigo-500 mt-1 font-medium">
                {analyticsData.topItems?.[0]?.count || 0} orders
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-500 dark:text-slate-400 font-medium mb-2">Total Customers</h3>
              <p className="text-4xl font-bold text-slate-800 dark:text-white">{customers.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Top Selling Items</h3>
              <div className="space-y-4">
                {analyticsData.topItems?.map((item: {name: string, count: number}, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                        {i + 1}
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{item.count} orders</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col min-h-[300px]">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Daily Sales (Last 7 Days)</h3>
              <div className="flex-1 w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.dailySales || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short' })} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#818cf8' }}
                    />
                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Shop Settings */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
                <Store className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Shop Settings</h2>
            </div>
            
            <form onSubmit={updateShopSettings} className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300">Shop Status</span>
                <button
                  type="button"
                  onClick={() => setShopSettings({...shopSettings, is_open: shopSettings.is_open ? 0 : 1})}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${shopSettings.is_open ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${shopSettings.is_open ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Opening Hours</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-10 top-2 z-10">Open Time</label>
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="time"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className="w-full pl-10 pr-4 pt-6 pb-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors text-sm font-bold"
                    />
                  </div>
                  <div className="relative">
                    <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-10 top-2 z-10">Close Time</label>
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="time"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className="w-full pl-10 pr-4 pt-6 pb-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors text-sm font-bold"
                    />
                  </div>
                </div>
              </div>
              {/* AI Assistant Settings */}
              <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-indigo-600 p-2 rounded-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">AI Assistant Settings</h3>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Restaurant Details (AI Instructions)</label>
                  <textarea
                    rows={4}
                    value={shopSettings.ai_prompt}
                    onChange={(e) => setShopSettings({...shopSettings, ai_prompt: e.target.value})}
                    placeholder="Describe your restaurant, menu highlights, and vibe for the AI assistant..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">AI API Key</label>
                  <input
                    type="password"
                    value={shopSettings.ai_api_key}
                    onChange={(e) => setShopSettings({...shopSettings, ai_api_key: e.target.value})}
                    placeholder="Paste your Gemini AI API key here"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors text-sm"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                Save Shop Settings
              </button>
            </form>
          </div>

          {/* User Management */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
                <UserCog className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">User Management</h2>
            </div>

            <form onSubmit={updateUserCredentials} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Role</label>
                <select
                  value={userUpdate.role}
                  onChange={(e) => setUserUpdate({...userUpdate, role: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors"
                >
                  <option value="admin">Admin</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="billing">Billing</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">New Username</label>
                <input
                  type="text"
                  value={userUpdate.username}
                  onChange={(e) => setUserUpdate({...userUpdate, username: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={userUpdate.password}
                    onChange={(e) => setUserUpdate({...userUpdate, password: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-slate-800 dark:bg-slate-700 text-white py-3 rounded-xl font-bold hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors"
              >
                Update Credentials
              </button>
            </form>
          </div>

          {/* Logout Section */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-red-200 dark:border-red-900/30 col-span-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                <LogOut className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Logout</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Exit your admin session securely</p>
              </div>
            </div>
            <button 
              onClick={() => logout({ dashboard: 'admin' })}
              className="w-full md:w-auto bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" /> Sign Out from Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
