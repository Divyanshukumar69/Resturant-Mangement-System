import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { IndianRupee, Printer, X, Banknote, QrCode, Ticket, Tag, Loader2, LogOut } from 'lucide-react';
import QRCode from 'qrcode';
import { Order, OrderItem } from '../types';

export default function BillingDashboard() {
  const socket = useSocket();
  const { token, restaurantId, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    if (printOrder) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        window.print();
        setPrintOrder(null);
      }, 500);
    }
  }, [printOrder]);

  const markPaid = useCallback(async (orderId: number) => {
    const orderToPrint = orders.find(o => o.id === orderId) || selectedOrder;
    if (!orderToPrint) return;

    const finalAmount = discountPercent > 0 
      ? orderToPrint.total_amount * (1 - discountPercent / 100)
      : orderToPrint.total_amount;

    const printData: Order = {
      ...orderToPrint,
      discount_applied: discountPercent,
      final_amount: finalAmount
    };
    
    setPrintOrder(printData);

    await fetch('/api/staff/order/pay', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        orderId,
        discountCode: couponCode,
        finalAmount
      }),
    });
    
    // Success TTS
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance("भुगतान सफल रहा. रसीद तैयार है.");
      msg.lang = 'hi-IN';
      window.speechSynthesis.speak(msg);
    }

    setShowPaymentModal(false);
    setPaymentMethod(null);
    setCouponCode('');
    setDiscountPercent(0);
  }, [orders, selectedOrder, token, discountPercent, couponCode]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplying(true);
    setCouponError('');
    try {
      const res = await fetch('/api/staff/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: couponCode })
      });
      const data = await res.json();
      if (data.valid) {
        setDiscountPercent(data.percentage);
        setCouponError('');
      } else {
        setCouponError(data.error || 'Invalid code');
        setDiscountPercent(0);
      }
    } catch {
      setCouponError('Error validating coupon');
    } finally {
      setIsApplying(false);
    }
  };

  // Simulate automatic payment detection for online payments
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (paymentMethod === 'online' && selectedOrder) {
      // Simulate waiting for bank webhook
      timer = setTimeout(() => {
        // Auto-confirm payment
        markPaid(selectedOrder.id);
      }, 8000); // 8 seconds delay to simulate user scanning and paying
    }
    return () => clearTimeout(timer);
  }, [paymentMethod, selectedOrder, markPaid]);

  useEffect(() => {
    fetch('/api/staff/orders', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setOrders(data));
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
      console.log('BillingDashboard: Received new_order', order);
      setOrders(prev => [order, ...prev]);
      
      // TTS Notification
      if ('speechSynthesis' in window) {
        const textToSpeak = `नया ऑर्डर आया है. टेबल ${order.table_name}.`;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'hi-IN';
        window.speechSynthesis.speak(utterance);
      }
    };

    const handleOrderUpdate = (updatedOrder: Order) => {
      console.log('BillingDashboard: Received order_updated', updatedOrder);
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    };

    const handleOrderPaid = ({ orderId }: { orderId: number }) => {
      console.log('BillingDashboard: Received order_paid', orderId);
      // Instead of removing, we update the status so it moves to "Completed" section
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'paid' } : o));
    };

    const handleSystemReset = () => {
      console.log('BillingDashboard: Received system_reset');
      setOrders([]);
      setSelectedOrder(null);
      setShowPaymentModal(false);
      setPaymentMethod(null);
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
  }, [socket, restaurantId]);

  const initiatePayment = (order: Order) => {
    setSelectedOrder(order);
    setPaymentMethod(null);
    setQrCodeUrl('');
    setShowPaymentModal(true);
  };

  const handlePaymentMethodSelect = async (method: 'cash' | 'online') => {
    setPaymentMethod(method);
    if (method === 'online' && selectedOrder) {
      // Generate UPI QR Code
      // Format: upi://pay?pa=MOBILE_NUMBER&pn=NAME&am=AMOUNT&tr=REF_ID&tn=NOTE
      
      const payeeName = "NextGen Software";
      const mobileNumber = "9534722845"; 
      
      const vpa = `${mobileNumber}@upi`; 
      const amount = discountPercent > 0 
        ? (selectedOrder.total_amount * (1 - discountPercent / 100)).toFixed(2)
        : selectedOrder.total_amount;
        
      const note = `${selectedOrder.customer_nickname || 'Customer'} - ${selectedOrder.items.map((i) => i.name_at_time).join(', ')}`.substring(0, 50); 
      
      const upiString = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(note)}`;
      
      try {
        const url = await QRCode.toDataURL(upiString, { width: 300, margin: 2 });
        setQrCodeUrl(url);
      } catch (err) {
        console.error(err);
        alert('Failed to generate QR code');
      }
    }
  };

  const pendingOrders = orders.filter(o => o.status !== 'paid');
  const completedOrders = orders.filter(o => o.status === 'paid');

  const OrderTable = ({ title, orders, showPayButton }: { title: string, orders: Order[], showPayButton: boolean }) => (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-2 h-8 rounded-full ${showPayButton ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
        <h2 className="text-xl font-bold text-white uppercase tracking-wider">{title}</h2>
        <span className="bg-white/10 text-white px-2 py-0.5 rounded-md text-xs font-mono">{orders.length}</span>
      </div>
      
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-widest text-slate-400">
            <tr>
              <th className="p-4 font-semibold">Table</th>
              <th className="p-4 font-semibold">Customer</th>
              <th className="p-4 font-semibold">Items</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Total</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                <td className="p-4 font-medium text-white">
                  <div className="flex flex-col">
                    <span className="text-lg">{order.table_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">#{order.id}</span>
                  </div>
                </td>
                <td className="p-4 text-slate-300">{order.customer_nickname || '-'}</td>
                <td className="p-4 text-slate-300 text-sm max-w-xs">
                  {order.items.map((i: OrderItem) => `${i.quantity}x ${i.name_at_time}`).join(', ')}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                    order.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                    order.status === 'ready' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${
                      order.status === 'paid' ? 'bg-emerald-500' : 
                      order.status === 'ready' ? 'bg-blue-500' :
                      'bg-amber-500'
                    }`}></span>
                    {order.status}
                  </span>
                </td>
                <td className="p-4 font-bold text-white text-lg">₹{order.total_amount}</td>
                <td className="p-4 text-right">
                  <div className="flex gap-2 justify-end">
                    {showPayButton && (
                      <button 
                        onClick={() => initiatePayment(order)}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] flex items-center gap-2 transition-all active:scale-95"
                      >
                        <IndianRupee className="w-3.5 h-3.5" /> Pay Now
                      </button>
                    )}
                    <button 
                      onClick={() => setPrintOrder(order)}
                      className={`p-2 rounded-xl transition-all ${
                        !showPayButton ? 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="p-12 text-center text-slate-500 italic text-sm">
            No bills found in this category
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 print:p-0 print:bg-white font-sans text-slate-200">
      <div className="print:hidden max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">Billing Center</h1>
              <p className="text-slate-400 text-sm mt-1">Manage orders and process payments</p>
            </div>
            <div className="flex gap-4">
               <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Sync Active</span>
               </div>
               <button 
                  onClick={() => logout({ dashboard: 'billing' })}
                  className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 px-4 py-3 rounded-2xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-widest"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
            </div>
        </div>

        <OrderTable title="Pending Payment" orders={pendingOrders} showPayButton={true} />
        <OrderTable title="Completed Today" orders={completedOrders} showPayButton={false} />
      </div>

      {/* Printable Receipt - Only visible when printing */}
      {printOrder && (
        <div className="hidden print:block p-8 max-w-sm mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-1">NextGen Software</h1>
            <p className="text-sm text-gray-500">Bangalore, India</p>
            <p className="text-sm text-gray-500">Ph: 9534722845</p>
          </div>
          
          <div className="border-b border-dashed border-gray-300 mb-4 pb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Date:</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>Time:</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Order #:</span>
              <span>{printOrder.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Table:</span>
              <span>{printOrder.table_name}</span>
            </div>
            {((printOrder.discount_applied || 0) > 0) && (
              <div className="flex justify-between text-sm text-green-600 font-bold">
                <span>Discount:</span>
                <span>-{printOrder.discount_applied}%</span>
              </div>
            )}
          </div>

          <div className="mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1">Item</th>
                  <th className="text-center py-1">Qty</th>
                  <th className="text-right py-1">Price</th>
                </tr>
              </thead>
              <tbody>
                {printOrder.items.map((item: OrderItem, idx: number) => (
                  <tr key={idx}>
                    <td className="py-1">{item.name_at_time}</td>
                    <td className="text-center py-1">{item.quantity}</td>
                    <td className="text-right py-1">₹{item.price_at_time * item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-4 mb-8">
            <div className="flex justify-between text-sm mb-1">
              <span>Subtotal:</span>
              <span>₹{printOrder.total_amount}</span>
            </div>
            {((printOrder.discount_applied || 0) > 0) && (
              <div className="flex justify-between text-sm text-green-600 mb-1">
                <span>Discount ({printOrder.discount_applied}%):</span>
                <span>-₹{(printOrder.total_amount * (printOrder.discount_applied || 0) / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t border-gray-100 pt-2 mt-2">
              <span>TOTAL</span>
              <span>₹{printOrder.final_amount || printOrder.total_amount}</span>
            </div>
            <div className="text-center text-xs text-gray-400 mt-4">
              Thank you for dining with us!
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Payment for Table {selectedOrder.table_name}</h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="text-center mb-6">
                  <p className="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">Amount to Pay</p>
                  <div className="flex items-center justify-center gap-3">
                    {discountPercent > 0 && (
                      <p className="text-xl font-bold text-slate-400 line-through">₹{selectedOrder.total_amount}</p>
                    )}
                    <p className="text-4xl font-black text-slate-900">
                      ₹{discountPercent > 0 
                        ? (selectedOrder.total_amount * (1 - discountPercent / 100)).toFixed(2)
                        : selectedOrder.total_amount}
                    </p>
                  </div>
                  {discountPercent > 0 && (
                    <p className="text-green-600 font-bold text-sm mt-1">
                      <Tag className="w-3 h-3 inline mr-1" />
                      Coupon Applied: {discountPercent}% OFF
                    </p>
                  )}
                </div>

                {/* Coupon Code Input */}
                <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Ticket className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Coupon Code</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="COUPON123"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        disabled={discountPercent > 0}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                      />
                    </div>
                    {discountPercent > 0 ? (
                      <button 
                        onClick={() => { setDiscountPercent(0); setCouponCode(''); }}
                        className="text-red-500 px-3 text-sm font-bold hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Reset
                      </button>
                    ) : (
                      <button 
                        onClick={applyCoupon}
                        disabled={isApplying || !couponCode.trim()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                      </button>
                    )}
                  </div>
                  {couponError && <p className="text-red-500 text-xs mt-2 font-medium">{couponError}</p>}
                </div>

                {!paymentMethod ? (
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => handlePaymentMethodSelect('cash')}
                      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-100 hover:border-green-500 hover:bg-green-50 transition-all group"
                    >
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 group-hover:bg-green-200">
                        <Banknote className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-slate-700 group-hover:text-green-700">Cash</span>
                    </button>

                    <button 
                      onClick={() => handlePaymentMethodSelect('online')}
                      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 group-hover:bg-blue-200">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-slate-700 group-hover:text-blue-700">Online / UPI</span>
                    </button>
                  </div>
                ) : paymentMethod === 'cash' ? (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
                      <Banknote className="w-10 h-10" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Cash Payment</h4>
                    <p className="text-slate-500 mb-8">
                      Please collect <span className="font-bold text-slate-900 text-2xl">₹{discountPercent > 0 
                        ? (selectedOrder.total_amount * (1 - discountPercent / 100)).toFixed(2)
                        : selectedOrder.total_amount}</span> from the customer.
                    </p>
                    
                    <button 
                      onClick={() => markPaid(selectedOrder.id)}
                      className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" /> Confirm & Print Bill
                    </button>
                    
                    <button 
                      onClick={() => setPaymentMethod(null)}
                      className="mt-3 text-slate-500 text-sm hover:text-slate-700"
                    >
                      Back to methods
                    </button>
                  </div>
                ) : paymentMethod === 'online' ? (
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block mb-4 shadow-sm relative">
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48" />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-slate-400">Generating QR...</div>
                      )}
                      
                      {/* Simulation Indicator */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center backdrop-blur-sm"
                      >
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p className="text-sm font-medium text-blue-800">Waiting for payment...</p>
                        <p className="text-xs text-blue-600 mt-1">(Simulating success in 8s)</p>
                      </motion.div>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">Scan with any UPI app to pay</p>
                    
                    <button 
                      onClick={() => markPaid(selectedOrder.id)}
                      className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" /> Payment Received
                    </button>
                    
                    <button 
                      onClick={() => setPaymentMethod(null)}
                      className="mt-3 text-slate-500 text-sm hover:text-slate-700"
                    >
                      Back to methods
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper component for icon
function CheckCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}
