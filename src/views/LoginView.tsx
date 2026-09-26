import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Sparkles, Lock, User, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo.tsx';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Login failed. Please check credentials.');
    }
  };

  const setDemoAccount = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        
        {/* Left Column: Luxury Venue Branding */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#14281D] via-[#102218] to-[#0A160F] p-6 sm:p-8 lg:p-12 text-[#FBF9F5] flex flex-col justify-between relative overflow-hidden">
          {/* Subtle decorative gold glow */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#C5A059]/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-[#C5A059]/10 blur-3xl pointer-events-none" />

          {/* Top Logo */}
          <div className="relative z-10 flex flex-col items-start">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#C5A059]/20 border border-[#C5A059]/30 text-[#E2C07D] text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Internal Enterprise Portal</span>
            </div>

            <BrandLogo variant="horizontal" theme="dark" size="lg" />
          </div>

          {/* Center Visual Motif & Features (Visible on large screens) */}
          <div className="hidden lg:block my-6 relative z-10 space-y-4">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-3.5">
              <div>
                <h3 className="text-sm font-bold text-[#F3E7C4] font-brand tracking-wide">
                  A Complete Venue for Your Celebration
                </h3>
                <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                  Everything you need under one roof — from the ceremony to the stay.
                </p>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-bold mb-2.5 flex items-center space-x-1.5">
                  <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                  <span>Bandhan Vatika Highlights</span>
                </div>
                <ul className="text-xs text-stone-200 space-y-2">
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>Spacious banquet halls (Capacity up to 400 guests)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>4 Halls (3 AC, 1 Non-AC)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>Bandhan Vatika Stage Setup & Stage setup area</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>Catering & Decoration available</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>10 guest rooms (6 AC, 4 Non-AC)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>Parking support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>Easy road access on Ara-Buxar Main Road</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="hidden lg:flex relative z-10 pt-4 border-t border-white/10 items-center justify-between text-[11px] text-stone-400">
            <span>Bandhan Vatika Hospitality Suite</span>
            <span className="flex items-center space-x-1 text-[#C5A059]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Strict RBAC Protected</span>
            </span>
          </div>
        </div>

        {/* Right Column: Sign In Form */}
        <div className="lg:col-span-6 p-6 sm:p-8 lg:p-12 flex flex-col justify-between bg-white">
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900 font-brand">Staff Sign In</h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-1">
                Enter your credentials to access the venue management console
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin or admin@bandhanvatika.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 rounded-xl text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 rounded-xl text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#14281D] hover:bg-[#1a3527] active:scale-[0.99] text-[#F3E7C4] font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Bandhan Vatika'}</span>
                <ArrowRight className="w-4 h-4 text-[#C5A059]" />
              </button>
            </form>
          </div>

          {/* Quick Demo Switcher for fast evaluation */}
          <div className="mt-8 pt-6 border-t border-stone-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2.5">
              Quick Demo Accounts (1-Click Fill)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoAccount('admin', 'admin123')}
                className="px-2.5 py-1.5 text-left rounded-lg bg-stone-50 hover:bg-[#14281D]/5 border border-stone-200 text-stone-700 transition-colors"
              >
                <div className="text-xs font-bold text-stone-900">Owner</div>
                <div className="text-[10px] text-stone-500">Full Access</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('manager', 'manager123')}
                className="px-2.5 py-1.5 text-left rounded-lg bg-stone-50 hover:bg-[#14281D]/5 border border-stone-200 text-stone-700 transition-colors"
              >
                <div className="text-xs font-bold text-stone-900">Manager</div>
                <div className="text-[10px] text-stone-500">Bookings & Ops</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('accountant', 'accountant123')}
                className="px-2.5 py-1.5 text-left rounded-lg bg-stone-50 hover:bg-[#14281D]/5 border border-stone-200 text-stone-700 transition-colors"
              >
                <div className="text-xs font-bold text-stone-900">Accountant</div>
                <div className="text-[10px] text-stone-500">Billing & P&L</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('reception', 'reception123')}
                className="px-2.5 py-1.5 text-left rounded-lg bg-stone-50 hover:bg-[#14281D]/5 border border-stone-200 text-stone-700 transition-colors"
              >
                <div className="text-xs font-bold text-stone-900">Receptionist</div>
                <div className="text-[10px] text-stone-500">Desk & Check-in</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('staff', 'staff123')}
                className="px-2.5 py-1.5 text-left rounded-lg bg-stone-50 hover:bg-[#14281D]/5 border border-stone-200 text-stone-700 transition-colors"
              >
                <div className="text-xs font-bold text-stone-900">Staff</div>
                <div className="text-[10px] text-stone-500">Schedule View</div>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
