import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useConfig } from './context/ConfigContext';
import { apiRequest } from './lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { auth, db } from './lib/firebase';
import { signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LogIn, ShieldCheck, User as UserIcon, Hash, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DonateModal } from './components/DonateModal';

export default function Login() {
  const [loginType, setLoginType] = useState<'email' | 'anggota'>('anggota');
  const [email, setEmail] = useState('');
  const [noAnggota, setNoAnggota] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isQrisOpen, setIsQrisOpen] = useState(false);
  const { setUser } = useAuth();
  const { orgName, logoUrl } = useConfig();
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        navigate('/');
      } else {
        setError('Akun terdaftar di Auth tapi belum memiliki profil di Database. Hubungi Admin.');
        await auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Metode Login ini belum diaktifkan di Firebase Console. Buka Authentication > Sign-in method dan aktifkan Email/Password.');
      } else {
        setError('Login gagal. Cek Email dan Password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnggotaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const data = await apiRequest('/login', {
        method: 'POST',
        body: { no_anggota: noAnggota, password }
      });

      // Save standard JWT to localStorage
      localStorage.setItem('token', data.token);
      
      // Update UI state directly (AuthContext will handle persistency)
      setUser({
        uid: data.user.id,
        noAnggota: data.user.no_anggota,
        namaLengkap: data.user.nama_lengkap,
        role: data.user.role,
        wilayah: data.user.wilayah,
        email: ''
      });

      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Login No. Anggota gagal.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Premium Dark Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      {/* Red & White Atmospheric Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[140px] z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px] z-0" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px] z-10"
      >
        <div className="flex flex-col items-center mb-12">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 15, delay: 0.2 }}
            className="w-48 h-48 flex items-center justify-center mb-6 relative group"
          >
            <div className="relative z-10 flex flex-col items-center">
              {logoUrl && logoUrl !== "" ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-44 h-44 object-contain drop-shadow-[0_0_40px_rgba(255,255,255,0.4)]" 
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <ShieldCheck className="w-16 h-16 text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
              )}
              <div className="mt-3 flex items-center justify-center gap-1.5 opacity-60">
                <div className="w-1 h-1 rounded-full bg-red-600/60" />
                <div className="w-1 h-1 rounded-full bg-red-600/40" />
                <div className="w-1 h-1 rounded-full bg-red-600/20" />
              </div>
            </div>
          </motion.div>
          
          <h1 className="text-3xl font-black text-white tracking-tight text-center leading-tight uppercase px-4">
            {orgName}
          </h1>
          
          <div className="flex items-center gap-4 mt-5">
            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-red-600" />
            <p className="text-[11px] font-black text-red-500 tracking-[0.5em] uppercase">Login Portal</p>
            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-red-600" />
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2rem] p-10 shadow-[0_30px_100px_rgba(0,0,0,0.4)] border border-white/5 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white text-[9px] font-black px-6 py-2 rounded-full uppercase tracking-[0.3em] shadow-2xl shadow-red-600/40 border border-red-500">
            Members Access
          </div>

          <div className="flex bg-black/40 p-1.5 rounded-2xl mb-8 border border-white/5">
            <button 
              onClick={() => setLoginType('anggota')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${loginType === 'anggota' ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              No. Anggota
            </button>
            <button 
              onClick={() => setLoginType('email')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${loginType === 'email' ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Email Account
            </button>
          </div>

          <form onSubmit={loginType === 'email' ? handleEmailLogin : handleAnggotaLogin} className="space-y-7">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-950/30 text-red-400 p-4 rounded-2xl border border-red-900/50 text-[11px] font-bold flex items-center gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                {error}
              </motion.div>
            )}
            
            <AnimatePresence mode="wait">
              {loginType === 'email' ? (
                <motion.div 
                  key="email-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-7"
                >
                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">Email</Label>
                    <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-red-500 transition-colors" />
                      <Input 
                        id="email" 
                        type="email"
                        autoComplete="email"
                        placeholder="admin@example.com" 
                        className="pl-12 h-14 text-xs font-bold border-white/5 bg-black/20 text-white focus:bg-black/40 transition-all rounded-2xl border-2 focus:border-red-600/30 tracking-widest placeholder:text-slate-700" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="anggota-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-7"
                >
                  <div className="space-y-2.5">
                    <Label htmlFor="noAnggota" className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">No. Anggota</Label>
                    <div className="relative group">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-red-500 transition-colors" />
                      <Input 
                        id="noAnggota" 
                        type="text"
                        placeholder="Contoh: 12345" 
                        className="pl-12 h-14 text-xs font-bold border-white/5 bg-black/20 text-white focus:bg-black/40 transition-all rounded-2xl border-2 focus:border-red-600/30 tracking-widest placeholder:text-slate-700" 
                        value={noAnggota}
                        onChange={(e) => setNoAnggota(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center ml-1">
                <Label htmlFor="password" className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Password</Label>
                <button type="button" className="text-[10px] font-bold text-red-500 hover:text-red-400 transition-colors">Bantuan?</button>
              </div>
              <div className="relative group">
                <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-red-500 transition-colors" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••••••"
                  className="pl-12 h-14 text-xs border-white/5 bg-black/20 text-white focus:bg-black/40 transition-all rounded-2xl border-2 focus:border-red-600/30 placeholder:text-slate-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                type="submit"
                className="w-full h-14 text-xs font-black uppercase tracking-[0.3em] bg-white text-black hover:bg-red-600 hover:text-white shadow-2xl transition-all duration-500 rounded-2xl group overflow-hidden relative" 
                disabled={isLoading}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    loginType === 'email' ? "LOGIN EMAIL" : "LOGIN ANGGOTA"
                  )}
                </span>
              </Button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Atau</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              <Button 
                type="button"
                onClick={() => setIsQrisOpen(true)}
                className="w-full h-12 text-[10px] font-black uppercase tracking-[0.2em] bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all duration-300 rounded-2xl flex items-center justify-center gap-3"
              >
                <QrCode className="w-4 h-4" />
                 Scan QRIS LSP
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-12 flex flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-4 opacity-30">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-white" />
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-white" />
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">
            WEBAPP-LSP SISTEM • IT DIVISION
          </p>
        </div>
      </motion.div>

      <DonateModal open={isQrisOpen} onOpenChange={setIsQrisOpen} />
    </div>
  );
}
