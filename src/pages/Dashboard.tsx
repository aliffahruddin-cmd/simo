import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  MapPin, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [diag, setDiag] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user?.role === 'ADMIN') {
          apiRequest('/admin/diagnose').then(setDiag).catch(() => {});
        }
        const [members, finance] = await Promise.all([
          apiRequest('/members'),
          apiRequest('/finance'),
        ]);

        const totalMembers = members.length;
        const dppCount = members.filter((m: any) => m.pengurus === 'DPP').length;
        const dpdCount = members.filter((m: any) => m.pengurus === 'DPD').length;
        const dpcCount = members.filter((m: any) => m.pengurus === 'DPC').length;
        const pacCount = members.filter((m: any) => m.pengurus === 'PAC').length;

        const income = finance.filter((f: any) => f.jenis === 'Pemasukan').reduce((acc: number, curr: any) => acc + curr.nominal, 0);
        const expense = finance.filter((f: any) => f.jenis === 'Pengeluaran').reduce((acc: number, curr: any) => acc + curr.nominal, 0);
        const balance = income - expense;

        setStats({
          totalMembers,
          dppCount,
          dpdCount,
          dpcCount,
          pacCount,
          balance,
          income,
          expense
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) return <DashboardSkeleton />;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Dashboard {user?.role === 'ADMIN' ? 'Sistem' : user?.role}
        </h1>
        <p className="text-slate-500 font-medium">Selamat Datang Sedulur, <span className="text-primary">{user?.namaLengkap}</span></p>
      </header>
      
      {diag && diag.firestoreStatus !== 'working' && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border-2 border-rose-500 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 shadow-xl shadow-rose-900/10"
        >
          <div className="w-16 h-16 bg-rose-600 rounded-full flex items-center justify-center shrink-0">
            <Layers className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-black text-rose-900 tracking-tight uppercase">Koneksi Database Bermasalah</h3>
            <p className="text-rose-700 text-sm font-medium leading-relaxed max-w-2xl mt-1">
              Sinkronisasi Cloud Firestore belum aktif. Anda perlu memperbarui konfigurasi Firebase di menu System Console agar backup data otomatis berjalan.
            </p>
          </div>
          <button 
            onClick={() => navigate('/console')}
            className="px-6 py-3 bg-rose-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-rose-700 transition-all flex items-center gap-3 shadow-lg shadow-rose-600/30 shrink-0"
          >
            Buka Console <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Anggota" 
          value={stats?.totalMembers} 
          icon={Users} 
          color="text-blue-600 bg-blue-50" 
          description="Keseluruhan jaringan"
        />
        <StatCard 
          title="Saldo Kas" 
          value={formatCurrency(stats?.balance)} 
          icon={Wallet} 
          color="text-emerald-600 bg-emerald-50"
          description="Total akumulasi"
        />
        <StatCard 
          title="Pemasukan" 
          value={formatCurrency(stats?.income)} 
          icon={TrendingUp} 
          color="text-indigo-600 bg-indigo-50"
          description="Bulan ini"
        />
        <StatCard 
          title="Pengeluaran" 
          value={formatCurrency(stats?.expense)} 
          icon={TrendingDown} 
          color="text-rose-600 bg-rose-50"
          description="Bulan ini"
        />
      </div>

      {/* Levels Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card-dense">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
              <Layers className="w-4 h-4 text-blue-500" /> Distribusi Wilayah
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <LevelBox label="DPP" value={stats?.dppCount} icon={Building2} color="text-amber-600 bg-amber-50" />
              <LevelBox label="DPD" value={stats?.dpdCount} icon={MapPin} color="text-sky-600 bg-sky-50" />
              <LevelBox label="DPC" value={stats?.dpcCount} icon={MapPin} color="text-indigo-600 bg-indigo-50" />
              <LevelBox label="PAC" value={stats?.pacCount} icon={MapPin} color="text-emerald-600 bg-emerald-50" />
            </div>
            
            <div className="mt-4 p-4 bg-slate-50/50 rounded border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ringkasan Organisasi</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Saat ini sistem mencatat total <span className="font-bold text-slate-900">{stats?.totalMembers}</span> anggota aktif 
                yang tersebar di berbagai tingkatan mulai dari Pusat (DPP) hingga Anak Cabang (PAC). 
              </p>
              <div className="mt-4 flex gap-3">
                <div className="flex-1 p-3 bg-white rounded border border-slate-200">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Aktivitas</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-slate-900">85%</span>
                    <span className="text-[9px] text-emerald-600 font-bold">+2.4%</span>
                  </div>
                </div>
                <div className="flex-1 p-3 bg-white rounded border border-slate-200">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Pelaporan</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-slate-900">92%</span>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-tighter">Lengkap</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions / Info */}
        <div className="card-dense bg-slate-900 text-white border-slate-800 shadow-xl shadow-slate-900/10">
          <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Informasi Sistem</h3>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-black text-emerald-500 uppercase">Live</span>
            </div>
          </div>
          <div className="p-3 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-0.5">
                <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Status</p>
                <p className="text-[11px] font-bold text-slate-100">Aktif</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Wilayah</p>
                <p className="text-[11px] font-bold text-slate-100 truncate">{user?.wilayah}</p>
              </div>
            </div>
            
            <div className="space-y-1.5 pt-3 border-t border-slate-800">
              <QuickAction label="Tambah Anggota" />
              <QuickAction label="Input Laporan" />
              <QuickAction label="Unduh Laporan" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, description }: any) {
  return (
    <div className="stat-card">
      <div className="flex justify-between items-start">
        <div className={cn("p-1.5 rounded", color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Real-time</div>
      </div>
      <div className="mt-2">
        <p className="stat-value">{value}</p>
        <p className="stat-label">{title}</p>
      </div>
      <p className="text-[10px] text-slate-400 font-medium mt-1 border-t border-slate-50 pt-1">{description}</p>
    </div>
  );
}

function LevelBox({ label, value, icon: Icon, color }: any) {
  return (
    <div className={cn("p-3 rounded border flex flex-col items-center justify-center gap-1 transition-colors", color, "border-current/10")}>
      <Icon className="w-3.5 h-3.5 opacity-60" />
      <span className="text-xl font-black leading-none">{value || 0}</span>
      <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</span>
    </div>
  );
}

function QuickAction({ label }: { label: string }) {
  return (
    <button className="w-full flex items-center justify-between group py-1.5 hover:translate-x-1 transition-transform">
      <span className="font-medium text-xs text-slate-300 group-hover:text-white transition-colors">{label}</span>
      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-500 transition-colors" />
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-slate-200 rounded-2xl" />
        <div className="h-96 bg-slate-200 rounded-2xl" />
      </div>
    </div>
  );
}

const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');
