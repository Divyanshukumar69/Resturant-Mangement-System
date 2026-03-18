import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Table, MenuItem, Category } from '../types';
import { ShoppingCart, Plus, Minus, Search, CheckCircle2, LogOut } from 'lucide-react';

export default function WaiterDashboard() {
  const { token, restaurantId, logout } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<Category[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [cart, setCart] = useState<{item: MenuItem, quantity: number}[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    
    fetch('/api/staff/tables', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setTables(data));

    fetch(`/api/public/menu/${restaurantId}`)
      .then(res => res.json())
      .then(data => {
        setMenu(data);
        if (data.length > 0) setActiveCategory(data[0].id);
      });
  }, [token, restaurantId]);

  const socket = useSocket();
  useEffect(() => {
    if (!socket || !restaurantId) return;

    socket.emit('join_restaurant', restaurantId);

    const handleTableUpdate = () => {
      fetch('/api/staff/tables', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setTables(data));
    };

    socket.on('table:updated', handleTableUpdate);

    return () => {
      socket.off('table:updated', handleTableUpdate);
    };
  }, [socket, restaurantId, token]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.item.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.item.id !== itemId);
    });
  };

  const placeOrder = async () => {
    if (!selectedTable || cart.length === 0) return;

    const res = await fetch('/api/public/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        tableId: selectedTable.id,
        items: cart.map(c => ({ 
          id: c.item.id, 
          quantity: c.quantity,
          price: c.item.price,
          name: c.item.name 
        })),
        customerNickname: 'Waiter Order'
      })
    });

    if (res.ok) {
      setCart([]);
      setSelectedTable(null);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 3000);
    }
  };

  const filteredItems = menu.flatMap(c => c.items).filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-4 md:p-6 flex flex-col md:flex-row gap-6">
      {/* Left Side: Tables & Menu */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Select Table</h2>
            <button 
              onClick={() => logout({ dashboard: 'waiter' })}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 px-4 py-2 rounded-xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-widest"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {tables.map(table => (
              <button
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className={`min-w-[100px] p-4 rounded-xl font-bold transition-colors ${
                  selectedTable?.id === table.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {table.name}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex flex-col">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Menu</h2>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
            </div>
          </div>

          {!searchQuery && (
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
              {menu.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2">
            {(searchQuery ? filteredItems : menu.find(c => c.id === activeCategory)?.items || []).map(item => {
              const cartItem = cart.find(c => c.item.id === item.id);
              return (
                <div key={item.id} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">{item.name}</h3>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold">₹{item.price}</p>
                  </div>
                  {cartItem ? (
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm">
                      <button onClick={() => removeFromCart(item.id)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold w-4 text-center dark:text-white">{cartItem.quantity}</span>
                      <button onClick={() => addToCart(item)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => addToCart(item)}
                      className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-lg font-bold hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Side: Cart */}
      <div className="w-full md:w-96 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col h-[calc(100vh-3rem)] sticky top-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Current Order</h2>
        </div>

        {!selectedTable ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-center p-6">
            Please select a table first to start taking an order.
          </div>
        ) : cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-center p-6">
            Cart is empty. Add items from the menu.
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-6">
              {cart.map(c => (
                <div key={c.item.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{c.item.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">₹{c.item.price} x {c.quantity}</p>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-white">₹{c.item.price * c.quantity}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mb-6">
              <div className="flex justify-between items-center text-lg font-bold text-slate-800 dark:text-white">
                <span>Total</span>
                <span>₹{cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0)}</span>
              </div>
            </div>

            <button
              onClick={placeOrder}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              Send to Kitchen
            </button>
          </>
        )}

        {orderSuccess && (
          <div className="absolute inset-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-10">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Order Sent!</h3>
            <p className="text-slate-500 dark:text-slate-400">Kitchen has been notified.</p>
          </div>
        )}
      </div>
    </div>
  );
}
