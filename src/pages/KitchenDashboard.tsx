import { useEffect, useState, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, ChefHat, Utensils, Volume2, X, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { Order, OrderItem } from '../types';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

let globalAudioCtx: AudioContext | null = null;
const initAudio = async () => {
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    globalAudioCtx = new AudioContextClass();
  }
  if (globalAudioCtx.state === 'suspended') {
    await globalAudioCtx.resume();
  }
  return globalAudioCtx;
};

export default function KitchenDashboard() {
  const socket = useSocket();
  const { token, restaurantId, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const announcedOrders = useRef<Set<number>>(new Set());

  // Initialize speech voices early
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const playNotification = useCallback((order: Order) => {
    if (!soundEnabled || announcedOrders.current.has(order.id)) return;
    
    announcedOrders.current.add(order.id);

    try {
      initAudio();
      // Since initAudio is async, we can't easily wait here in a sync callback, 
      // but initAudio handles its internal state. For notification, we'll try-catch.
      initAudio().then(ctx => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); // Drop to A4
        
        gainNode.gain.setValueAtTime(1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.start();
        oscillator.stop(ctx.currentTime + 1);
      });
    } catch (err) {
      console.error("Audio bell failed", err);
    }

    // Wait for bell to finish before speaking
    setTimeout(async () => {
      if (!('speechSynthesis' in window)) return;
      
      // Cancel previous speech to prioritize new order
      window.speechSynthesis.cancel();
      
      const itemsText = order.items?.map(item => `${item.quantity} ${item.name_at_time}`).join(', ') || '';
      const textToSpeak = `नया ऑर्डर आया है. टेबल ${order.table_name}. ${itemsText}`;
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.9; // Slightly slower for clarity
      
      // Try to find a Hindi voice
      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find(v => v.lang.includes('hi')) || voices.find(v => v.lang.includes('IN'));
      if (hindiVoice) {
        utterance.voice = hindiVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }, 1200);
  }, [soundEnabled]);

  const enableAudio = async () => {
    try {
      await initAudio();
      setSoundEnabled(true);
      // Speak a brief confirmation
      const msg = new SpeechSynthesisUtterance("ऑडियो सूचनाएं सक्रिय हैं");
      msg.lang = 'hi-IN';
      window.speechSynthesis.speak(msg);
    } catch (err) {
      console.error("Failed to enable audio:", err);
    }
  };

  useEffect(() => {
    // Load voices early
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    
    fetch('/api/staff/orders', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      const activeOrders = data.filter((o: Order) => o.status !== 'paid');
      setOrders(activeOrders);
      activeOrders.forEach((o: Order) => announcedOrders.current.add(o.id));
    })
    .catch(err => console.error('KitchenDashboard: Failed to fetch initial orders', err));
  }, [token]);

  useEffect(() => {
    if (!socket || !restaurantId) return;

    const joinRoom = () => {
      socket.emit('join_restaurant', restaurantId);
    };

    if (socket.connected) {
      joinRoom();
    }

    socket.on('connect', joinRoom);

    const handleNewOrder = (order: Order) => {
      setOrders(prev => [order, ...prev]);
      playNotification(order);
    };

    const handleOrderUpdate = (updatedOrder: Order) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    };

    const handleSystemReset = () => {
      setOrders([]);
      announcedOrders.current.clear();
    };

    const handleOrderPaid = ({ orderId }: { orderId: number }) => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_updated', handleOrderUpdate);
    socket.on('order_paid', handleOrderPaid);
    socket.on('system_reset', handleSystemReset);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('new_order', handleNewOrder);
      socket.off('order_updated', handleOrderUpdate);
      socket.off('order_paid', handleOrderPaid);
      socket.off('system_reset', handleSystemReset);
    };
  }, [socket, restaurantId, playNotification]);

  const updateStatus = async (orderId: number, status: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as Order['status'] } : o));

    await fetch('/api/staff/order/status', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ orderId, status }),
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      case 'preparing': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'ready': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg ring-4 ring-indigo-500/20">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Kitchen Dashboard</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Live Updates Enabled</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
                onClick={() => logout({ dashboard: 'kitchen' })}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-400 hover:text-red-500 border border-slate-200 dark:border-slate-700 hover:border-red-200 px-5 py-3 rounded-2xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-widest"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>

             {!soundEnabled ? (
                <button 
                  onClick={enableAudio}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-indigo-200 dark:shadow-none"
                >
                  <div className="relative">
                    <Volume2 className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping"></span>
                  </div>
                  Activate Order Speaker
                </button>
             ) : (
                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-5 py-3 rounded-2xl border-2 border-emerald-500/20 shadow-sm ring-4 ring-emerald-500/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Speaker Live</span>
                  </div>
                  <button 
                    onClick={() => setSoundEnabled(false)}
                    className="ml-2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    title="Disable Audio"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
             )}
          </div>
        </div>

        <div className="flex gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-8 w-fit">
          <div className="px-4 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800/50 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse"></div>
            <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
              {orders.filter(o => o.status === 'pending').length} Pending
            </span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
              {orders.filter(o => o.status === 'preparing').length} Prep
            </span>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {orders.map(order => (
              <motion.div 
                key={order.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col"
              >
                {/* Card Header */}
                <div className={cn("p-4 border-b flex justify-between items-center", getStatusColor(order.status))}>
                  <div className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 opacity-70" />
                    <h3 className="font-bold text-lg">Table {order.table_name}</h3>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold opacity-70">#{order.id}</span>
                    <span className="text-[10px] font-mono opacity-60">
                      {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
                
                {/* Order Items */}
                <div className="p-5 flex-1 bg-white dark:bg-slate-800">
                  <div className="space-y-3">
                    {order.items.map((item: OrderItem) => (
                      <div key={item.id} className="flex justify-between items-start group">
                        <div className="flex gap-3">
                          <span className="font-bold text-slate-900 dark:text-white min-w-[1.5rem] h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded text-sm">
                            {item.quantity}
                          </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                            {item.name_at_time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
                  {order.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 text-center py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider mb-1">
                        New Order
                      </div>
                      <button 
                        onClick={() => updateStatus(order.id, 'preparing')}
                        className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Loader2 className="w-4 h-4" /> Start Preparing
                      </button>
                    </div>
                  )}
                  
                  {order.status === 'preparing' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-center py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider mb-1">
                        Preparing...
                      </div>
                      <button 
                        onClick={() => updateStatus(order.id, 'ready')}
                        className="col-span-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-green-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Mark Ready
                      </button>
                    </div>
                  )}
                  
                  {order.status === 'ready' && (
                    <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-bold py-2 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30">
                      <CheckCircle className="w-5 h-5" /> Ready to Serve
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
