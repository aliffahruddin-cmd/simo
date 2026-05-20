import React, { useState } from 'react';
import { Database, Download, Upload, Server, FileJson, AlertTriangle, CheckCircle2, QrCode, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { apiRequest, resolveUrl } from '@/src/lib/api';

export default function MaintenancePage() {
  const { user } = useAuth();
  const { refreshConfig } = useConfig();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [merchantNameInput, setMerchantNameInput] = useState('');

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
        <h2 className="text-xl font-bold">Akses Terbatas</h2>
        <p>Hanya administrator yang dapat mengakses menu ini.</p>
      </div>
    );
  }

  const handleUpdateMerchant = async () => {
    if (!merchantNameInput.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      await apiRequest('/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantName: merchantNameInput })
      });
      setStatus({ type: 'success', message: 'Nama merchant QRIS berhasil diperbarui.' });
      refreshConfig();
      setMerchantNameInput('');
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleQrisUpload = async (file: File) => {
    setLoading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append('qris', file);

      await apiRequest('/config/qris', {
        method: 'POST',
        body: formData
      });

      setStatus({ type: 'success', message: 'Gambar QRIS berhasil diperbarui.' });
      refreshConfig();
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async (type: 'db' | 'full' | 'json') => {
    setLoading(true);
    setStatus(null);
    try {
      const token = localStorage.getItem('token');
      let url = '';
      if (type === 'db') url = '/api/admin/backup/db';
      else if (type === 'full') url = '/api/admin/backup/full';
      else if (type === 'json') url = '/api/admin/export/tables';

      const response = await fetch(resolveUrl(`${url}?token=${token}`));
      if (!response.ok) throw new Error('Gagal mengunduh cadangan');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const extension = type === 'json' ? 'json' : (type === 'full' ? 'zip' : 'db');
      a.download = `backup_${type}_${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setStatus({ type: 'success', message: 'Cadangan berhasil diunduh.' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (type: 'db' | 'full' | 'json', file: File) => {
    setLoading(true);
    setStatus(null);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      let url = '';
      let method = 'POST';
      let body: any = formData;
      let headers: any = { 'Authorization': `Bearer ${token}` };

      if (type === 'db') url = '/api/admin/restore/db';
      else if (type === 'full') url = '/api/admin/restore/full';
      else if (type === 'json') {
        url = '/api/admin/import/tables';
        const text = await file.text();
        body = text;
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(resolveUrl(url), {
        method,
        headers,
        body
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Gagal memulihkan cadangan');

      setStatus({ type: 'success', message: result.message || 'Pemulihan berhasil dilakukan.' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Server className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Maintenance & Backup</h1>
          <p className="text-slate-500 font-medium">Kelola integritas data dan cadangan sistem</p>
        </div>
      </div>

      {status && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl border flex items-center gap-3",
            status.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
          )}
        >
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="font-bold text-sm">{status.message}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* QRIS & Donation Config */}
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-emerald-600 to-teal-600" />
          <CardHeader>
            <div className="p-2 w-fit rounded-lg bg-emerald-50 text-emerald-600 mb-2 group-hover:scale-110 transition-transform">
              <QrCode className="w-6 h-6" />
            </div>
            <CardTitle className="font-black text-xl italic uppercase tracking-tighter">Pengaturan QRIS</CardTitle>
            <CardDescription>Ubah gambar QRIS dan nama merchant yang muncul di modal infaq.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-slate-400 block px-1">Upload QRIS Baru</Label>
              <Input 
                type="file" 
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleQrisUpload(e.target.files[0])}
                disabled={loading}
                className="text-xs h-9 cursor-pointer"
              />
            </div>
            
            <div className="pt-2">
              <Label className="text-[10px] uppercase font-black text-slate-400 block px-1 mb-1">Nama Merchant</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Nama Merchant QRIS..."
                  value={merchantNameInput}
                  onChange={(e) => setMerchantNameInput(e.target.value)}
                  className="text-xs h-9"
                  disabled={loading}
                />
                <Button 
                  size="sm"
                  variant="secondary"
                  className="h-9 font-bold px-3"
                  onClick={handleUpdateMerchant}
                  disabled={loading || !merchantNameInput.trim()}
                >
                  Simpan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Full Backup */}
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
          <CardHeader>
            <div className="p-2 w-fit rounded-lg bg-blue-50 text-blue-600 mb-2 group-hover:scale-110 transition-transform">
              <Database className="w-6 h-6" />
            </div>
            <CardTitle className="font-black text-xl italic uppercase tracking-tighter">Full Backup</CardTitle>
            <CardDescription>Mencadangkan seluruh database (SQLite) dan folder unggahan (Media).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full gap-2 font-bold bg-blue-600 hover:bg-blue-700 h-11"
              disabled={loading}
              onClick={() => handleBackup('full')}
            >
              <Download className="w-4 h-4" /> Unduh ZIP Full Backup
            </Button>
            <div className="pt-4 border-t border-slate-100">
              <Label className="text-[10px] uppercase font-black text-slate-400 mb-2 block">Restore dari ZIP</Label>
              <Input 
                type="file" 
                accept=".zip"
                onChange={(e) => e.target.files?.[0] && handleRestore('full', e.target.files[0])}
                disabled={loading}
                className="text-xs h-9 cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        {/* Database Only */}
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardHeader>
            <div className="p-2 w-fit rounded-lg bg-amber-50 text-amber-500 mb-2 group-hover:scale-110 transition-transform">
              <Database className="w-6 h-6" />
            </div>
            <CardTitle className="font-black text-xl italic uppercase tracking-tighter">Database Only</CardTitle>
            <CardDescription>Mencadangkan file utama pangkalan data (SQLite) tanpa folder media.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full gap-2 font-bold bg-amber-500 hover:bg-amber-600 h-11"
              disabled={loading}
              onClick={() => handleBackup('db')}
            >
              <Download className="w-4 h-4" /> Unduh .DB Backup
            </Button>
            <div className="pt-4 border-t border-slate-100">
              <Label className="text-[10px] uppercase font-black text-slate-400 mb-2 block">Restore dari .DB</Label>
              <Input 
                type="file" 
                accept=".db"
                onChange={(e) => e.target.files?.[0] && handleRestore('db', e.target.files[0])}
                disabled={loading}
                className="text-xs h-9 cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        {/* JSON Table Export */}
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader>
            <div className="p-2 w-fit rounded-lg bg-emerald-50 text-emerald-500 mb-2 group-hover:scale-110 transition-transform">
              <FileJson className="w-6 h-6" />
            </div>
            <CardTitle className="font-black text-xl italic uppercase tracking-tighter">Table JSON</CardTitle>
            <CardDescription>Ekspor data tabel ke format JSON. Berguna untuk sinkronisasi antar sistem.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 h-11"
              disabled={loading}
              onClick={() => handleBackup('json')}
            >
              <Download className="w-4 h-4" /> Ekspor JSON Tables
            </Button>
            <div className="pt-4 border-t border-slate-100">
              <Label className="text-[10px] uppercase font-black text-slate-400 mb-2 block">Impor dari JSON</Label>
              <Input 
                type="file" 
                accept=".json"
                onChange={(e) => e.target.files?.[0] && handleRestore('json', e.target.files[0])}
                disabled={loading}
                className="text-xs h-9 cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex flex-col sm:flex-row gap-4 items-center">
        <div className="p-3 bg-amber-100 rounded-full text-amber-600">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h3 className="font-black text-amber-900 uppercase italic">Peringatan Keamanan</h3>
          <p className="text-sm text-amber-800 font-medium">
            Melakukan pemulihan (restore) akan menimpa data yang ada saat ini. Pastikan Anda telah mengunduh cadangan terbaru sebelum melakukan pemulihan. Sistem akan memulai ulang secara otomatis setelah proses pemulihan selesai.
          </p>
        </div>
      </div>
    </div>
  );
}
