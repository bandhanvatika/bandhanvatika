import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Sparkles,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  PhoneCall,
  KeyRound,
  Building2,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo.tsx';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Invalid credentials. Please verify your username and password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EFE6] flex items-center justify-center p-3 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#C5A059]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#14281D]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(20,40,29,0.22)] border border-[#EADBBE]/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px] relative z-10">
        
        {/* =========================================================================
            LEFT COLUMN: Royal Emerald Branding & Highlights
           ========================================================================= */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#14281D] via-[#102218] to-[#0A160F] p-6 sm:p-8 lg:p-12 text-[#FBF9F5] flex flex-col justify-between relative overflow-hidden">
          {/* Subtle gold decorative radial glows */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#C5A059]/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-[#C5A059]/10 blur-3xl pointer-events-none" />

          {/* Top Logo */}
          <div className="relative z-10 flex flex-col items-start">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#C5A059]/20 border border-[#C5A059]/30 text-[#E2C07D] text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-6 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#E2C07D]" />
              <span>Internal Enterprise Portal</span>
            </div>

            <BrandLogo variant="horizontal" theme="dark" size="lg" />
          </div>

          {/* Center Visual Motif & Venue Highlights */}
          <div className="hidden lg:block my-6 relative z-10 space-y-4">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3.5 shadow-inner">
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
                    <span>Bandhan Vatika Stage Setup &amp; Open Lawn Area</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>Catering &amp; Decoration available</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>10 guest rooms (6 AC, 4 Non-AC)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>Parking support &amp; Easy road access</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Left Footer note */}
          <div className="hidden lg:flex relative z-10 pt-4 border-t border-white/10 items-center justify-between text-[11px] text-stone-400">
            <span>Bandhan Vatika Hospitality Suite</span>
            <span className="flex items-center space-x-1 text-[#C5A059] font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Strict RBAC Protected</span>
            </span>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: Beautiful Luxury Sign In Experience
           ========================================================================= */}
        <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-gradient-to-b from-[#FFFDF9] via-white to-[#FBF8F2] relative">
          
          {/* Subtle decorative gold top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C5A059] via-[#E2C07D] to-[#14281D]" />

          <div>
            {/* Top Blessed Invocation & Badge */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold text-[#8B6B23] tracking-widest uppercase">
                ॥ श्री गणेशाय नमः ॥
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#14281D]/5 border border-[#14281D]/10 text-[10px] font-bold text-[#14281D] uppercase tracking-wider">
                <Building2 className="w-3 h-3 text-[#C5A059]" />
                <span>Management Suite</span>
              </span>
            </div>

            {/* Header Title & Subtitle */}
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-[#14281D] font-brand tracking-tight">
                Bandhan Vatika Login
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-1.5 leading-relaxed">
                Enter your credentials to access banquet bookings, billing &amp; administration.
              </p>
            </div>

            {/* Error Message Box */}
            {error && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in shadow-xs">
                <div className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                <span className="grow">{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
              
              {/* Username Input */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Username or Email</span>
                  <span className="text-[10px] font-normal text-stone-400 capitalize">e.g. admin</span>
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B6B23] transition-colors group-focus-within:text-[#14281D]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username or email"
                    className="w-full pl-10 pr-4 py-3 bg-[#FAF8F5] hover:bg-[#F7F4EE] focus:bg-white border border-[#E3DACB] focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/15 rounded-xl text-sm font-medium text-stone-900 outline-none transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    Password
                  </label>
                  <span className="text-[10px] text-stone-400">Case-sensitive</span>
                </div>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B6B23] transition-colors group-focus-within:text-[#14281D]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-3 bg-[#FAF8F5] hover:bg-[#F7F4EE] focus:bg-white border border-[#E3DACB] focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/15 rounded-xl text-sm font-medium text-stone-900 outline-none transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-800 p-1.5 transition-colors rounded-lg hover:bg-stone-100"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-[#8B6B23]" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember device & Security note */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none text-stone-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-stone-300 text-[#14281D] focus:ring-[#C5A059] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="font-medium text-[11.5px]">Stay signed in</span>
                </label>

                <div className="flex items-center space-x-1 text-stone-500 text-[11px]">
                  <Shield className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>256-bit Encrypted</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#14281D] via-[#1A3828] to-[#14281D] hover:from-[#183224] hover:to-[#183224] active:scale-[0.99] text-[#F3E7C4] font-bold text-sm rounded-xl shadow-lg shadow-[#14281D]/20 hover:shadow-xl hover:shadow-[#14281D]/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-3 group cursor-pointer"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Bandhan Vatika'}</span>
                <ArrowRight className="w-4 h-4 text-[#C5A059] group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>

          {/* =========================================================================
              BOTTOM SECURITY & SUPPORT FOOTER (Fills the card elegantly)
             ========================================================================= */}
          <div className="mt-8 pt-6 border-t border-[#EADBBE]/60">
            <div className="grid grid-cols-2 gap-3 text-[11px] text-stone-600">
              {/* Help & Support */}
              <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EADBBE]/50">
                <PhoneCall className="w-3.5 h-3.5 text-[#8B6B23] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-stone-800">Support Desk</div>
                  <div className="text-[10px] text-stone-500 font-mono">9431086933, 8789182989</div>
                </div>
              </div>

              {/* Roles Protected */}
              <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EADBBE]/50">
                <KeyRound className="w-3.5 h-3.5 text-[#8B6B23] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-stone-800">Authorized Roles</div>
                  <div className="text-[10px] text-stone-500">Owner · Manager · Accounts</div>
                </div>
              </div>
            </div>

            <p className="text-center text-[10px] text-stone-400 mt-4 tracking-wide font-medium">
              Bandhan Vatika Banquet Hall &amp; Hotel • Ara, Bihar
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
