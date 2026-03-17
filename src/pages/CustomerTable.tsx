import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, ChevronRight, Store, Star, Search, ShoppingCart, X, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '../lib/utils';
import { useSocket } from '../context/SocketContext';
import { MenuItem, Category, Order } from '../types';

interface CartItem extends MenuItem {
  quantity: number;
  specialInstructions?: string;
}

interface Restaurant {
  id: number;
  restaurant_id: number;
  name: string;
  is_open: boolean;
  opening_hours: string;
  ai_prompt?: string;
}

export default function CustomerTable() {
  const { tableId } = useParams();
  const socket = useSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeCategory, setActiveCategory] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  
  const [nickname, setNickname] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Chatbot State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `${restaurant?.ai_prompt || 'You are a helpful restaurant assistant.'}. The customer asked: "${userMsg}". 
      Here is the menu: ${JSON.stringify(menu.flatMap(c => c.items).map(i => ({ name: i.name, desc: i.description, price: i.price }))) }. 
      - If they ask "What is best dish?", recommend the highest rated special items.
      - If they ask "Show spicy food", filter for items with "spicy" in the description.
      - If they ask "Suggest vegetarian meal", suggest vegetarian items (assume items without meat in description).
      - Otherwise, answer their question concisely based on the menu. 
      - If they ask something unrelated to the restaurant, politely decline.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      
      setChatMessages(prev => [...prev, { role: 'ai', text: response.text || "Sorry, I couldn't generate a response." }]);
    } catch (err) {
      console.error('DEBUG: Chat error:', err);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const submitRating = async () => {
    if (!currentOrder || rating === 0) return;
    try {
      await fetch('/api/public/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant?.restaurant_id,
          orderId: currentOrder.id,
          rating,
          feedback
        })
      });
      setRatingSubmitted(true);
    } catch (err) {
      console.error('Failed to submit rating', err);
    }
  };

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Listen for order updates
  useEffect(() => {
    if (!socket || !currentOrder) return;

    const handleOrderUpdate = (updatedOrder: Order) => {
      if (updatedOrder.id === currentOrder.id) {
        setCurrentOrder(updatedOrder);
      }
    };

    socket.on('order_updated', handleOrderUpdate);

    return () => {
      socket.off('order_updated', handleOrderUpdate);
    };
  }, [socket, currentOrder]);

  // Fetch Table & Restaurant Info
  useEffect(() => {
    fetch(`/api/public/table/${tableId}`)
      .then(res => res.ok ? res.json() : Promise.reject('Invalid Table'))
      .then(data => {
        setRestaurant(data);
        
        if (socket) {
          const joinRoom = () => {
             socket.emit('join_restaurant', data.restaurant_id);
          };
          
          if (socket.connected) {
            joinRoom();
          }
          
          socket.on('connect', joinRoom);
          
          // Store cleanup function in a way we can return it
          return { data, joinRoom };
        }
        return { data, joinRoom: null };
      })
      .then(({ data }) => {
        return fetch(`/api/public/menu/${data.restaurant_id}`)
          .then(res => res.json())
          .then(menuData => {
             setMenu(menuData);
             if (menuData.length > 0) setActiveCategory(menuData[0].id);
             setLoading(false);
          });
      })
      .catch(err => {
        setError(err.toString());
        setLoading(false);
      });
  }, [tableId, socket]);

  // Listen for menu updates
  useEffect(() => {
    if (!socket || !restaurant) return;

    const handleMenuUpdate = () => {
      console.log('CustomerTable: Menu updated, refreshing...');
      fetch(`/api/public/menu/${restaurant.restaurant_id}`)
        .then(res => res.json())
        .then(data => setMenu(data));
    };

    socket.on('menu:updated', handleMenuUpdate);

    return () => {
      socket.off('menu:updated', handleMenuUpdate);
    };
  }, [socket, restaurant]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== itemId);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = async () => {
    if (!nickname) {
      alert('Please enter your name');
      return;
    }

    if (!restaurant) return;

    try {
      const res = await fetch('/api/public/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.restaurant_id,
          tableId: restaurant.id,
          customerNickname: nickname,
          items: cart.map(c => ({ 
            ...c,
            specialInstructions: c.specialInstructions 
          }))
        }),
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        // We need the full order object. For now, construct a basic one to track status
        setCurrentOrder({
          id: data.orderId,
          restaurant_id: restaurant.restaurant_id,
          table_id: restaurant.id,
          table_name: restaurant.name,
          customer_nickname: nickname,
          status: 'pending',
          total_amount: cartTotal,
          created_at: new Date().toISOString(),
          items: cart.map(c => ({ id: Math.random(), order_id: data.orderId, menu_item_id: c.id, quantity: c.quantity, price_at_time: c.price, name_at_time: c.name }))
        });
        setOrderPlaced(true);
        setCart([]);
        setShowCart(false);
      }
    } catch {
      alert('Failed to place order');
    }
  };

  const filteredItems = menu.flatMap(cat => cat.items).filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 dark:text-white">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500 bg-white dark:bg-slate-900">{error}</div>;

  // Shop Closed Check
  if (restaurant && !restaurant.is_open) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-white dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 max-w-sm w-full">
          <Store className="w-16 h-16 text-slate-400 mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Shop is Closed</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">We are currently closed for orders. Please check back later.</p>
          
          <div className="bg-slate-50 dark:bg-slate-700 px-4 py-3 rounded-lg border border-slate-100 dark:border-slate-600">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Opening Hours</p>
            <p className="text-lg font-bold text-slate-800 dark:text-white">{restaurant.opening_hours || '09:00 AM - 10:00 PM'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (orderPlaced && currentOrder) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
          <div className="bg-indigo-600 p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-2">Order #{currentOrder.id}</h2>
            <p className="text-indigo-200 font-medium">For {nickname} at Table {restaurant?.name}</p>
          </div>
          
          <div className="p-8">
          </div>

          {(currentOrder.status === 'ready' || currentOrder.status === 'completed' || currentOrder.status === 'paid') && !ratingSubmitted && (
            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-100 dark:border-indigo-800/50 text-center">
              <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-3">Rate your food</h3>
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className="focus:outline-none transition-transform hover:scale-110">
                    <Star className={cn("w-8 h-8", rating >= star ? "text-yellow-400 fill-current" : "text-slate-300 dark:text-slate-600")} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                  <textarea 
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us what you liked..."
                    className="w-full p-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    rows={2}
                  />
                  <button 
                    onClick={submitRating}
                    className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                  >
                    Submit Feedback
                  </button>
                </div>
              )}
            </div>
          )}

          {ratingSubmitted && (
            <div className="p-6 bg-green-50 dark:bg-green-900/20 border-t border-green-100 dark:border-green-800/50 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-green-900 dark:text-green-100">Thank you!</h3>
              <p className="text-sm text-green-700 dark:text-green-300">Your feedback helps us improve.</p>
            </div>
          )}

          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
            <button 
              onClick={() => {
                setOrderPlaced(false);
                setNickname('');
                setCurrentOrder(null);
                setRating(0);
                setFeedback('');
                setRatingSubmitted(false);
              }}
              className="w-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-600 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            >
              Place another order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 pb-32 transition-colors duration-200">
      {/* Top Section */}
      <div className="bg-white dark:bg-slate-800 p-4 sticky top-0 z-20 shadow-sm transition-colors duration-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">{restaurant.name}</h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">Table {restaurant.name}</span>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search for food..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 dark:bg-slate-700 border-0 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors"
          />
        </div>
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="overflow-x-auto whitespace-nowrap p-4 gap-3 flex bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 sticky top-[130px] z-10 transition-colors duration-200">
          {menu.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                activeCategory === cat.id 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none" 
                  : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Menu Items */}
      <div className="p-2 md:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full mx-auto">
        {(searchQuery ? filteredItems : menu.find(c => c.id === activeCategory)?.items || []).map(item => {
          const inCart = cart.find(i => i.id === item.id);
          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex"
            >
              {/* Image Section */}
              <div className="w-32 h-32 flex-shrink-0 relative">
                <img 
                  src={item.image_url || `https://picsum.photos/seed/${item.id}/200`} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {!!item.is_special && (
                  <div className="absolute top-0 left-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-br-lg">
                    SPECIAL
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className="flex-1 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-800 dark:text-white leading-tight mb-1">{item.name}</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setFavorites(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}>
                            <Star className={cn("w-5 h-5", favorites.includes(item.id) ? "text-yellow-400 fill-current" : "text-gray-300")} />
                        </button>
                        <div className="flex items-center bg-green-100 dark:bg-green-900 px-1.5 py-0.5 rounded text-[10px] font-bold text-green-700 dark:text-green-300">
                          {item.rating || 4.2} <Star className="w-2 h-2 ml-0.5 fill-current" />
                        </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{item.description}</p>
                </div>

                <div className="flex justify-between items-end">
                  <p className="text-base font-bold text-gray-900 dark:text-white">₹{item.price}</p>
                  
                  {inCart ? (
                    <div className="flex items-center bg-indigo-50 dark:bg-indigo-900/30 rounded-lg overflow-hidden border border-indigo-100 dark:border-indigo-800">
                      <button onClick={() => removeFromCart(item.id)} className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center font-bold text-sm text-indigo-700 dark:text-indigo-300">{inCart.quantity}</span>
                      <button onClick={() => addToCart(item)} className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => addToCart(item)}
                      className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-50 dark:hover:bg-slate-600 transition-colors shadow-sm uppercase"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Floating Cart Bar */}
      <AnimatePresence>
        {cart.length > 0 && !showCart && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-4 left-4 right-4 z-40"
          >
            <button 
              onClick={() => setShowCart(true)}
              className="w-full bg-indigo-600 text-white p-4 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex justify-between items-center"
            >
              <div className="text-left">
                <p className="text-xs uppercase opacity-80 font-semibold">{cartCount} ITEMS</p>
                <p className="text-lg font-bold">₹{cartTotal}</p>
              </div>
              <div className="flex items-center font-bold">
                View Cart <ChevronRight className="w-5 h-5 ml-1" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Page / Drawer */}
      <AnimatePresence>
        {showCart && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col"
          >
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" /> Your Cart
              </h2>
              <button 
                onClick={() => setShowCart(false)}
                className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-600 dark:text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex flex-col gap-2 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-white">{item.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">₹{item.price} x {item.quantity}</p>
                      </div>
                    </div>
                    <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                      <button onClick={() => removeFromCart(item.id)} className="p-2 text-indigo-600 dark:text-indigo-400">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold text-gray-800 dark:text-white">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="p-2 text-indigo-600 dark:text-indigo-400">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Special instructions (e.g., no spicy)..."
                    value={item.specialInstructions || ''}
                    onChange={(e) => setCart(prev => prev.map(i => i.id === item.id ? {...i, specialInstructions: e.target.value} : i))}
                    className="w-full bg-white dark:bg-slate-700 border-0 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
              ))}

              {/* Smart Recommendations */}
              {cart.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-current" /> You may also like
                  </h3>
                  <div className="flex overflow-x-auto pb-4 gap-4 snap-x">
                    {menu.flatMap(c => c.items)
                      .filter(item => !cart.find(c => c.id === item.id))
                      .slice(0, 4)
                      .map(item => (
                        <div key={item.id} className="min-w-[160px] bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3 snap-start shrink-0">
                          <div className="w-full h-24 rounded-lg overflow-hidden mb-2">
                            <img src={item.image_url || `https://picsum.photos/seed/${item.id}/200`} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <h4 className="font-bold text-sm text-gray-800 dark:text-white truncate">{item.name}</h4>
                          <div className="flex justify-between items-center mt-2">
                            <span className="font-bold text-sm text-gray-900 dark:text-white">₹{item.price}</span>
                            <button 
                              onClick={() => addToCart(item)}
                              className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>
              
              <div className="flex justify-between items-center mb-4 text-lg font-bold text-gray-900 dark:text-white">
                <span>Grand Total</span>
                <span>₹{cartTotal}</span>
              </div>

              <button 
                onClick={placeOrder}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-colors"
              >
                Place Order
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Floating Chat Button */}
      {!showChat && !showCart && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setShowChat(true)}
          className="fixed bottom-24 right-4 z-40 bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-colors"
        >
          <MessageSquare className="w-6 h-6" />
        </motion.button>
      )}


      {/* Chat Drawer */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col"
          >
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-6 h-6" /> AI Assistant
              </h2>
              <button 
                onClick={() => setShowChat(false)}
                className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-600 dark:text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-slate-500 dark:text-slate-400 mt-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Hi! I can help you choose from our menu or answer any questions.</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-sm' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl rounded-tl-sm flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about the menu..."
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
                <button 
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-indigo-600 text-white p-3 rounded-xl disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
