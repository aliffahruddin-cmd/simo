import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { Transaction } from '../types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, Calendar, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function FinancePage() {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<string>('');
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<any>({
    tanggal: format(new Date(), 'yyyy-MM-dd'),
    jenis: 'Pemasukan',
    nominal: '',
    keterangan: '',
  });

  const fetchData = async () => {
    try {
      const result = await apiRequest('/finance');
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) {
      newErrors.tanggal = 'Tanggal wajib diisi';
    }
    const nominalNum = Number(formData.nominal);
    if (!formData.nominal || isNaN(nominalNum) || nominalNum <= 0) {
      newErrors.nominal = 'Nominal harus lebih besar dari 0';
    }
    if (!formData.keterangan || formData.keterangan.trim().length < 5) {
      newErrors.keterangan = 'Keterangan minimal 5 karakter';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    try {
      await apiRequest('/finance', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          nominal: Number(formData.nominal),
          approvalStatus: 'Pending'
        }),
      });
      setIsAddOpen(false);
      fetchData();
      setFormData({ tanggal: format(new Date(), 'yyyy-MM-dd'), jenis: 'Pemasukan', nominal: '', keterangan: '' });
      setErrors({});
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiRequest(`/finance/${deleteConfirmId}`, { method: 'DELETE' });
      alert('Transaksi berhasil dihapus');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      console.error('TRANS: Delete FAILED:', err);
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  const income = data.filter(d => d.jenis === 'Pemasukan').reduce((acc, curr) => acc + curr.nominal, 0);
  const expense = data.filter(d => d.jenis === 'Pengeluaran').reduce((acc, curr) => acc + curr.nominal, 0);
  const balance = income - expense;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Manajemen Keuangan</h1>
          <p className="text-slate-500">Monitoring kas organisasi secara real-time</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setErrors({});
        }}>
          <DialogTrigger render={
            <Button className="gap-2 font-bold shadow-lg bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Input Transaksi
            </Button>
          } />
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Catat Transaksi Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={errors.tanggal ? "text-red-500" : ""}>Tanggal</Label>
                  <Input 
                    type="date" 
                    value={formData.tanggal} 
                    onChange={e => {
                      setFormData({...formData, tanggal: e.target.value});
                      if (errors.tanggal) setErrors({...errors, tanggal: ''});
                    }} 
                    className={errors.tanggal ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errors.tanggal && <p className="text-[10px] text-red-500 font-bold">{errors.tanggal}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Jenis</Label>
                  <Select 
                    value={formData.jenis} 
                    onValueChange={(val: any) => setFormData({...formData, jenis: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pemasukan">Pemasukan</SelectItem>
                      <SelectItem value="Pengeluaran">Pengeluaran</SelectItem>
                      <SelectItem value="Lain-lain">Lain-lain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className={errors.nominal ? "text-red-500" : ""}>Nominal (IDR)</Label>
                <Input 
                  type="number" 
                  value={formData.nominal} 
                  onChange={e => {
                    setFormData({...formData, nominal: e.target.value});
                    if (errors.nominal) setErrors({...errors, nominal: ''});
                  }}
                  className={errors.nominal ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {errors.nominal && <p className="text-[10px] text-red-500 font-bold">{errors.nominal}</p>}
              </div>
              <div className="space-y-2">
                <Label className={errors.keterangan ? "text-red-500" : ""}>Keterangan</Label>
                <Input 
                  value={formData.keterangan} 
                  onChange={e => {
                    setFormData({...formData, keterangan: e.target.value});
                    if (errors.keterangan) setErrors({...errors, keterangan: ''});
                  }}
                  className={errors.keterangan ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {errors.keterangan && <p className="text-[10px] text-red-500 font-bold">{errors.keterangan}</p>}
              </div>
              <Button type="submit" className="w-full font-bold h-11 mt-4">Simpan Transaksi</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FinanceStat label="Total Pemasukan" value={formatCurrency(income)} icon={TrendingUp} color="text-emerald-600 bg-emerald-50" />
        <FinanceStat label="Total Pengeluaran" value={formatCurrency(expense)} icon={TrendingDown} color="text-rose-600 bg-rose-50" />
        <FinanceStat label="Saldo Akhir" value={formatCurrency(balance)} icon={Wallet} color="text-blue-600 bg-blue-50" />
      </div>

      <div className="card-dense">
        <table className="table-dense">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Keterangan</th>
              <th>Jenis</th>
              <th className="text-right">Nominal</th>
              <th>Operator</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.id} className="hover:bg-slate-50/50">
                <td>
                  <div className="flex items-center gap-2 text-slate-500 font-bold">
                    <Calendar className="w-3 h-3" />
                    {d.tanggal}
                  </div>
                </td>
                <td className="font-bold text-slate-700">
                  {d.keterangan}
                  <p className="text-[9px] text-slate-400 capitalize">{d.wilayah?.toLowerCase()}</p>
                </td>
                <td>
                  <Badge className={cn(
                    "px-1.5 py-0 text-[9px] uppercase font-black tracking-tighter",
                    d.jenis === 'Pemasukan' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    {d.jenis}
                  </Badge>
                </td>
                <td className={cn(
                   "text-right font-black text-sm tracking-tighter",
                   d.jenis === 'Pemasukan' ? "text-emerald-600" : "text-red-700"
                )}>
                  {d.jenis === 'Pemasukan' ? '+' : '-'} {formatCurrency(d.nominal)}
                </td>
                <td>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                    <CheckCircle2 className="w-2.5 h-2.5 text-blue-500" />
                    {d.operator?.split(' ')[0]}
                  </div>
                </td>
                <td>
                  {(user?.role === 'ADMIN' || user?.role === 'DPP') ? (
                    <Select 
                      defaultValue={d.approvalStatus || 'Pending'} 
                      onValueChange={async (newVal) => {
                        try {
                          await apiRequest(`/finance/${d.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ approvalStatus: newVal })
                          });
                          fetchData();
                        } catch (err: any) {
                          alert(`Gagal update status: ${err.message}`);
                        }
                      }}
                    >
                      <SelectTrigger className={cn(
                        "h-7 text-[9px] font-black w-[90px]",
                        (d.approvalStatus === 'Approved') ? "text-emerald-600 bg-emerald-50 border-emerald-200" : 
                        (d.approvalStatus === 'Rejected') ? "text-red-600 bg-red-50 border-red-200" : 
                        "text-amber-600 bg-amber-50 border-amber-200"
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">PENDING</SelectItem>
                        <SelectItem value="Approved">APPROVE</SelectItem>
                        <SelectItem value="Rejected">REJECT</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={cn(
                      "px-1.5 py-0.5 text-[9px] uppercase font-black",
                      (d.approvalStatus === 'Approved') ? "bg-emerald-50 text-emerald-600" : 
                      (d.approvalStatus === 'Rejected') ? "bg-red-50 text-red-600" : 
                      "bg-amber-50 text-amber-600"
                    )}>
                      {d.approvalStatus || 'Pending'}
                    </Badge>
                  )}
                </td>
                <td>
                  {(user?.role === 'ADMIN' || user?.role === 'DPP') && (
                    <button 
                      type="button"
                      className="h-7 w-7 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDeleteConfirmId(d.id);
                        setDeleteConfirmInfo(`${d.keterangan} (${formatCurrency(d.nominal)})`);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-[400px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-black uppercase tracking-tight">
              <AlertTriangle className="w-5 h-5" /> KONFIRMASI HAPUS TRANSAKSI
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data transaksi <span className="font-bold text-slate-900">{deleteConfirmInfo}</span>? Data ini akan dihapus permanen dari laporan keuangan.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="font-bold">BATAL</Button>
            <Button variant="destructive" onClick={handleDelete} className="font-black bg-red-600 hover:bg-red-700 shadow-xl shadow-red-100">HAPUS TRANSAKSI</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinanceStat({ label, value, icon: Icon, color }: any) {
  return (
    <div className={cn("p-4 rounded border flex flex-col gap-1 transition-all", color, "border-current/10")}>
      <div className="flex justify-between items-start mb-1">
        <Icon className="w-4 h-4 opacity-70" />
        <div className="text-[8px] font-black uppercase tracking-widest opacity-30">Financial</div>
      </div>
      <p className="text-xl font-black tracking-tighter">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
