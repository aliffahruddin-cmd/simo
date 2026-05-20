import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (password.length < 6) {
      setStatus({ type: 'error', message: 'Password minimal 6 karakter' });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: 'Konfirmasi password tidak cocok' });
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setStatus({ type: 'success', message: 'Password admin berhasil diperbarui!' });
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Gagal memperbarui password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-none shadow-2xl shadow-slate-200/60 overflow-hidden">
          <CardHeader className="bg-[#1e293b] text-white p-8">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
              <ShieldCheck className="w-6 h-6 text-red-500" />
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight">Update Password Admin</CardTitle>
            <CardDescription className="text-slate-400 font-medium pt-1">
              Hanya administrator yang memiliki wewenang untuk mengubah password akses utama sistem.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {status && (
                <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                  status.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                    : 'bg-rose-50 border-rose-100 text-rose-700'
                }`}>
                  {status.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0" />
                  )}
                  <p className="text-xs font-bold uppercase tracking-tight">{status.message}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Password Baru</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-10 h-12 border-slate-200 focus:border-blue-500 transition-all font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Konfirmasi Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-10 h-12 border-slate-200 focus:border-blue-500 transition-all font-bold"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 font-black uppercase tracking-widest bg-[#1e293b] hover:bg-red-600 transition-all duration-300 group"
                disabled={loading}
              >
                {loading ? 'Memproses...' : 'Perbarui Password Admin'}
              </Button>
              
              <div className="pt-4 border-t border-slate-100 mt-6">
                <div className="flex gap-3 text-amber-600 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-[10px] leading-relaxed font-bold uppercase tracking-tight">
                    Peringatan: Password ini mengontrol akses tertinggi. Pastikan Anda mencatat password baru dengan aman.
                  </p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
