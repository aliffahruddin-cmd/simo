import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { User, UserRole } from '../types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Trash2, Shield, MapPin, Edit, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user: currentUser } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  
  // Form State
  const [formData, setFormData] = useState({
    no_anggota: '',
    email: '',
    namaLengkap: '',
    password: '',
    role: 'PAC' as UserRole,
    wilayah: ''
  });

  const fetchUsers = async () => {
    try {
      const data = await apiRequest('/users');
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const validateForm = (isEdit: boolean) => {
    const newErrors: Record<string, string> = {};
    if (!formData.no_anggota) {
      newErrors.no_anggota = 'Nomor anggota wajib diisi';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format email tidak valid';
    }
    if (!formData.namaLengkap || formData.namaLengkap.trim().length < 3) {
      newErrors.namaLengkap = 'Nama lengkap minimal 3 karakter';
    }
    if (!isEdit && (!formData.password || formData.password.length < 6)) {
      newErrors.password = 'Password minimal 6 karakter';
    }
    if (isEdit && formData.password && formData.password.length < 6) {
      newErrors.password = 'Password minimal 6 karakter';
    }
    if (!formData.wilayah) {
      newErrors.wilayah = 'Wilayah wajib diisi';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          no_anggota: formData.no_anggota,
          email: formData.email,
          nama_lengkap: formData.namaLengkap,
          password: formData.password,
          role: formData.role,
          wilayah: formData.wilayah
        }),
      });
      setIsAddOpen(false);
      fetchUsers();
      setFormData({ no_anggota: '', email: '', namaLengkap: '', password: '', role: 'PAC', wilayah: '' });
      setErrors({});
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!validateForm(true)) return;
    try {
      await apiRequest(`/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          no_anggota: formData.no_anggota,
          nama_lengkap: formData.namaLengkap,
          password: formData.password || undefined,
          role: formData.role,
          wilayah: formData.wilayah
        }),
      });
      setIsEditOpen(false);
      fetchUsers();
      setSelectedUser(null);
      setFormData({ no_anggota: '', namaLengkap: '', password: '', role: 'PAC', wilayah: '' });
      setErrors({});
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEdit = (u: any) => {
    setSelectedUser(u);
    setErrors({});
    setFormData({
      no_anggota: u.no_anggota || u.noAnggota || '',
      namaLengkap: u.nama_lengkap || u.namaLengkap || '',
      password: '',
      role: u.role || 'PAC',
      wilayah: u.wilayah || ''
    });
    setIsEditOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiRequest(`/users/${deleteConfirmId}`, { method: 'DELETE' });
      alert('Pengguna berhasil dihapus');
      setDeleteConfirmId(null);
      fetchUsers();
    } catch (err: any) {
      console.error('USERS: Delete FAILED:', err);
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Manajemen Pengguna</h1>
          <p className="text-slate-500">Kelola akses pengurus wilayah dan pusat</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setErrors({});
        }}>
          <DialogTrigger render={
            <Button className="gap-2 font-bold shadow-lg">
              <UserPlus className="w-4 h-4" /> Tambah Pengguna
            </Button>
          } />
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Tambah Pengguna Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={errors.no_anggota ? "text-red-500" : ""}>Nomor Anggota</Label>
                  <Input 
                    value={formData.no_anggota} 
                    onChange={e => {
                      setFormData({...formData, no_anggota: e.target.value});
                      if (errors.no_anggota) setErrors({...errors, no_anggota: ''});
                    }} 
                    className={errors.no_anggota ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errors.no_anggota && <p className="text-[10px] text-red-500 font-bold">{errors.no_anggota}</p>}
                </div>
                <div className="space-y-2">
                  <Label className={errors.email ? "text-red-500" : ""}>Email (Opsional)</Label>
                  <Input 
                    type="email"
                    value={formData.email} 
                    onChange={e => {
                      setFormData({...formData, email: e.target.value});
                      if (errors.email) setErrors({...errors, email: ''});
                    }} 
                    placeholder="email@example.com"
                    className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errors.email && <p className="text-[10px] text-red-500 font-bold">{errors.email}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label className={errors.namaLengkap ? "text-red-500" : ""}>Nama Lengkap</Label>
                <Input 
                  value={formData.namaLengkap} 
                  onChange={e => {
                    setFormData({...formData, namaLengkap: e.target.value});
                    if (errors.namaLengkap) setErrors({...errors, namaLengkap: ''});
                  }} 
                  className={errors.namaLengkap ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {errors.namaLengkap && <p className="text-[10px] text-red-500 font-bold">{errors.namaLengkap}</p>}
              </div>
              <div className="space-y-2">
                <Label className={errors.password ? "text-red-500" : ""}>Password (Untuk Login)</Label>
                <Input 
                  type="password" 
                  value={formData.password} 
                  onChange={e => {
                    setFormData({...formData, password: e.target.value});
                    if (errors.password) setErrors({...errors, password: ''});
                  }} 
                  className={errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {errors.password && <p className="text-[10px] text-red-500 font-bold">{errors.password}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(val: any) => setFormData({...formData, role: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="DPP">Pengurus DPP</SelectItem>
                      <SelectItem value="DPD">Pengurus DPD</SelectItem>
                      <SelectItem value="DPC">Pengurus DPC</SelectItem>
                      <SelectItem value="PAC">Pengurus PAC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className={errors.wilayah ? "text-red-500" : ""}>Wilayah</Label>
                  <Input 
                    value={formData.wilayah} 
                    onChange={e => {
                      setFormData({...formData, wilayah: e.target.value});
                      if (errors.wilayah) setErrors({...errors, wilayah: ''});
                    }} 
                    placeholder="Contoh: Jawa Timur"
                    className={errors.wilayah ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errors.wilayah && <p className="text-[10px] text-red-500 font-bold">{errors.wilayah}</p>}
                </div>
              </div>
              <Button type="submit" className="w-full font-bold h-11 mt-4">Simpan Pengguna</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-dense">
        <table className="table-dense">
          <thead>
            <tr>
              <th>No. Anggota</th>
              <th>Email</th>
              <th>Nama Lengkap</th>
              <th>Role</th>
              <th>Wilayah</th>
              <th>Status Firebase</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="font-mono text-[10px] font-bold text-slate-400">{u.no_anggota || u.noAnggota}</td>
                <td className="text-[11px] font-medium text-slate-500">{u.email}</td>
                <td className="font-bold text-slate-800">{u.nama_lengkap || u.namaLengkap}</td>
                <td>
                  <Badge className="bg-slate-100 text-slate-600 border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter flex w-fit gap-1 items-center">
                    <Shield className="w-2.5 h-2.5 text-blue-500" />
                    {u.role}
                  </Badge>
                </td>
                <td>
                  <div className="flex items-center gap-1 text-slate-500 text-[10px] font-bold">
                    <MapPin className="w-2.5 h-2.5" />
                    {u.wilayah}
                  </div>
                </td>
                <td>
                  {u.email ? (
                    <Badge className={`${u.firebase_synced === true ? 'bg-emerald-50 text-emerald-600' : u.firebase_synced === 'UNKNOWN (LIMIT)' ? 'bg-slate-100 text-slate-500' : 'bg-rose-50 text-rose-600'} border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter flex w-fit gap-1 items-center`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${u.firebase_synced === true ? 'bg-emerald-500' : u.firebase_synced === 'UNKNOWN (LIMIT)' ? 'bg-slate-300' : 'bg-rose-500'}`} />
                      {u.firebase_synced === true ? 'Synced' : u.firebase_synced === 'UNKNOWN (LIMIT)' ? 'Identity Limit' : 'Unsynced'}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-slate-300 font-bold uppercase italic">N/A</span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2 px-3">
                    {u.no_anggota !== 'admin' && (
                      <>
                        <button 
                          type="button"
                          className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all active:scale-90 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('DEBUG: User edit button clicked');
                            openEdit(u);
                          }}
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          type="button"
                          className="h-9 w-9 flex items-center justify-center rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('DEBUG: User delete button clicked');
                            setDeleteConfirmId(u.id);
                            setDeleteConfirmName(u.nama_lengkap || u.namaLengkap || '');
                          }}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) {
          setSelectedUser(null);
          setErrors({});
        }
      }}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Pengguna</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={errors.no_anggota ? "text-red-500" : ""}>Nomor Anggota</Label>
                <Input 
                  value={formData.no_anggota} 
                  onChange={e => {
                    setFormData({...formData, no_anggota: e.target.value});
                    if (errors.no_anggota) setErrors({...errors, no_anggota: ''});
                  }} 
                  className={errors.no_anggota ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {errors.no_anggota && <p className="text-[10px] text-red-500 font-bold">{errors.no_anggota}</p>}
              </div>
              <div className="space-y-2">
                <Label className={errors.namaLengkap ? "text-red-500" : ""}>Nama Lengkap</Label>
                <Input 
                  value={formData.namaLengkap} 
                  onChange={e => {
                    setFormData({...formData, namaLengkap: e.target.value});
                    if (errors.namaLengkap) setErrors({...errors, namaLengkap: ''});
                  }} 
                  className={errors.namaLengkap ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {errors.namaLengkap && <p className="text-[10px] text-red-500 font-bold">{errors.namaLengkap}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label className={errors.password ? "text-red-500" : ""}>Password (Kosongkan jika tidak ingin ganti)</Label>
              <Input 
                type="password" 
                value={formData.password} 
                onChange={e => {
                  setFormData({...formData, password: e.target.value});
                  if (errors.password) setErrors({...errors, password: ''});
                }} 
                className={errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {errors.password && <p className="text-[10px] text-red-500 font-bold">{errors.password}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(val: any) => setFormData({...formData, role: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="DPP">Pengurus DPP</SelectItem>
                    <SelectItem value="DPD">Pengurus DPD</SelectItem>
                    <SelectItem value="DPC">Pengurus DPC</SelectItem>
                    <SelectItem value="PAC">Pengurus PAC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className={errors.wilayah ? "text-red-500" : ""}>Wilayah</Label>
                <Input 
                  value={formData.wilayah} 
                  onChange={e => {
                    setFormData({...formData, wilayah: e.target.value});
                    if (errors.wilayah) setErrors({...errors, wilayah: ''});
                  }} 
                  placeholder="Contoh: Jawa Timur"
                  className={errors.wilayah ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {errors.wilayah && <p className="text-[10px] text-red-500 font-bold">{errors.wilayah}</p>}
              </div>
            </div>
            <Button type="submit" className="w-full font-bold h-11 mt-4">Simpan Perubahan</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-[400px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-black uppercase tracking-tight">
              <AlertTriangle className="w-5 h-5" /> KONFIRMASI HAPUS AKUN
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun <span className="font-bold text-slate-900">{deleteConfirmName}</span>? Pengguna ini akan kehilangan akses ke sistem secara permanen.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="font-bold">BATAL</Button>
            <Button variant="destructive" onClick={handleDelete} className="font-black bg-red-600 hover:bg-red-700 shadow-xl shadow-red-100">HAPUS AKUN</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
