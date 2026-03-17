import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Phone, User, CheckCircle2, Sparkles, Copy, Ticket, ShieldCheck, ArrowRight, Loader2, Timer } from 'lucide-react';
import { Discount } from '../types';

type Step = 'info' | 'otp' | 'success';

export default function LandingPage() {
  const { restaurantId } = useParams();
  const [step, setStep] = useState<Step>('info');
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [welcomeCoupon, setWelcomeCoupon] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleGetOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Sanitize phone: remove +, ensure it starts with country code or assume 91 if 10 digits
    let sanitizedPhone = formData.phone.replace(/\D/g, '');
    if (sanitizedPhone.length === 10) sanitizedPhone = '91' + sanitizedPhone;
    
    try {
      const res = await fetch('/api/public/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, phone: sanitizedPhone })
      });
      const data = await res.json();
      
      if (res.ok) {
        setFormData({ ...formData, phone: sanitizedPhone });
        setStep('otp');
        setCountdown(30);
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch {
      setError('Connection failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/public/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone, otp, restaurantId })
      });
      const data = await res.json();

      if (res.ok && data.status === 'verified') {
        setWelcomeCoupon(data.coupon);
        // Fetch all active discounts from admin
        try {
          const discountRes = await fetch(`/api/public/discounts/${restaurantId}`);
          if (discountRes.ok) {
            const allDiscounts = await discountRes.json();
            setDiscounts(allDiscounts);
          }
        } catch {
          console.error('Failed to fetch discounts');
        }
        setStep('success');
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const renderStep = () => {
    switch (step) {
      case 'info':
        return (
          <motion.div 
            key="info"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/30">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Unlock Special Offers</h1>
              <p className="text-indigo-200">Get a surprise discount coupon on your WhatsApp!</p>
            </div>

            <form onSubmit={handleGetOTP} className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                <input
                  type="tel"
                  required
                  placeholder="WhatsApp Number (with country code)"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              {error && <p className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2 rounded-lg">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl py-4 font-bold text-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Get OTP</>}
              </button>
            </form>
          </motion.div>
        );

      case 'otp':
        return (
          <motion.div 
            key="otp"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 mb-4 shadow-lg shadow-green-500/30">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Verify WhatsApp</h1>
              <p className="text-indigo-200">We've sent a 6-digit code to <span className="text-white font-bold">{formData.phone}</span></p>
            </div>

            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="flex justify-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="0 0 0 0 0 0"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center bg-white/5 border border-white/10 rounded-2xl py-5 text-4xl font-black tracking-[1em] text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all placeholder:opacity-20"
                />
              </div>

              {error && <p className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2 rounded-lg">{error}</p>}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-white text-indigo-900 rounded-2xl py-4 font-bold text-lg hover:bg-slate-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Verify OTP</>}
              </button>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-indigo-300 text-sm flex items-center justify-center gap-1">
                    <Timer className="w-4 h-4" /> Resend in {countdown}s
                  </p>
                ) : (
                  <button 
                    type="button"
                    onClick={handleGetOTP}
                    className="text-indigo-400 hover:text-white text-sm font-bold flex items-center justify-center gap-1 mx-auto"
                  >
                    Resend Code <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        );

      case 'success':
        return (
          <motion.div 
            key="success"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.5)]"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-2">Verified! 🎉</h2>
            <p className="text-indigo-100 text-lg mb-8">Welcome {formData.name}, here are your offers!</p>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 scrollbar-hide">
              {/* Individual Welcome Coupon */}
              {welcomeCoupon && (
                <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 rounded-3xl border border-white/20 relative overflow-hidden text-left shadow-lg">
                  <div className="relative z-10 flex justify-between items-center">
                    <div>
                      <p className="text-emerald-200 uppercase text-[10px] font-bold tracking-widest mb-1">New User Gift</p>
                      <h3 className="text-2xl font-black text-white">WELCOME BONUS</h3>
                      <p className="text-white/80 text-sm font-bold mt-1">Flat ₹100 OFF</p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(welcomeCoupon)}
                      className="bg-white text-emerald-900 p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2 font-bold"
                    >
                      {copiedCode === welcomeCoupon ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      <span className="text-sm">{welcomeCoupon}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Admin Created Discounts */}
              {discounts.map((discount) => (
                <div key={discount.id} className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 relative overflow-hidden text-left group">
                  <Ticket className="absolute -right-4 -bottom-4 w-20 h-20 text-white/5 -rotate-12 group-hover:text-white/10 transition-colors" />
                  <div className="relative z-10 flex justify-between items-center">
                    <div>
                      <p className="text-indigo-300 uppercase text-[10px] font-bold tracking-widest mb-1">Active Offer</p>
                      <h3 className="text-2xl font-black text-white">{discount.percentage}% OFF</h3>
                      <p className="text-white/60 text-xs mt-1">Limited time offer</p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(discount.code)}
                      className="bg-indigo-600 text-white p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2 font-bold"
                    >
                      {copiedCode === discount.code ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      <span className="text-sm">{discount.code}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => window.location.href = `/menu/${restaurantId}`}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-2xl font-bold text-lg transition-all mt-8 shadow-xl shadow-indigo-500/20"
            >
              Order with Discount Now
            </button>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/30 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/30 rounded-full blur-[100px]" />

      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-md w-full relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
        
        <p className="text-center text-indigo-300/40 text-[10px] mt-8 uppercase tracking-widest font-bold">
          Secure Verification by WPPConnect
        </p>
      </div>
    </div>
  );
}


