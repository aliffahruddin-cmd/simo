import React, { useState, useEffect } from 'react';
import { apiRequest, resolveUrl } from '../lib/api';
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
import { Network, Plus, Trash2, User2, BadgeCheck, Edit, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function StructurePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberResults, setShowMemberResults] = useState(false);
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  
  const [formData, setFormData] = useState({
    no_anggota: '',
    nama_lengkap: '',
    jabatan: '',
  });

  const fetchData = async () => {
    try {
      const [structureRes, membersRes] = await Promise.all([
        apiRequest('/structure'),
        apiRequest('/members')
      ]);
      setData(structureRes);
      setMembers(membersRes);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.no_anggota) {
      newErrors.no_anggota = 'Nomor anggota wajib diisi';
    }
    if (!formData.nama_lengkap || formData.nama_lengkap.trim().length < 3) {
      newErrors.nama_lengkap = 'Nama lengkap minimal 3 karakter';
    }
    if (!formData.jabatan) {
      newErrors.jabatan = 'Jabatan wajib diisi';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingId) {
        await apiRequest(`/structure/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        alert('Struktur berhasil diupdate');
      } else {
        await apiRequest('/structure', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        alert('Struktur berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      fetchData();
      setFormData({ no_anggota: '', nama_lengkap: '', jabatan: '' });
      setEditingId(null);
      setMemberSearch('');
      setErrors({});
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    }
  };

  const openEdit = (item: any) => {
    console.log('Editing item:', item);
    setEditingId(item.id);
    setErrors({});
    setFormData({
      no_anggota: item.no_anggota || '',
      nama_lengkap: item.nama_lengkap || '',
      jabatan: item.jabatan || '',
    });
    setMemberSearch('');
    setIsDialogOpen(true);
  };

  const openAdd = () => {
    setEditingId(null);
    setErrors({});
    setFormData({ no_anggota: '', nama_lengkap: '', jabatan: '' });
    setMemberSearch('');
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    console.log('STRUCTURE: handleDelete triggered for ID:', id);
    
    try {
      setLoading(true);
      console.log('STRUCTURE: Executing DELETE for', id);
      await apiRequest(`/structure/${id}`, { method: 'DELETE' });
      alert('Data pengurus berhasil dihapus');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      console.error('STRUCTURE: Delete FAILED:', err);
      alert(`Gagal menghapus: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Memuat Struktur...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Manajemen Struktur</h1>
          <p className="text-slate-500 font-medium">Formasi Kepengurusan Laskar Sangidu Putih</p>
        </div>

        {(user?.role === 'ADMIN' || user?.role === 'DPP') && (
          <>
            <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 font-bold px-6 py-6 shadow-xl shadow-blue-100 transition-all active:scale-95 gap-2">
              <Plus className="w-5 h-5" /> TAMBAH PENGURUS
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setErrors({});
            }}>
              <DialogContent className="bg-white max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3">
                    {editingId ? 'EDIT DATA PENGURUS' : 'TAMBAH PENGURUS BARU'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 pt-4">
                  {/* ... contents identical ... */}
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-black text-[10px] uppercase tracking-widest">Cari Anggota (Database)</Label>
                    <div className="relative">
                      <Input 
                        placeholder="Masukkan nama atau nomor anggota..." 
                        value={memberSearch} 
                        onChange={e => {
                          setMemberSearch(e.target.value);
                          setShowMemberResults(true);
                        }}
                        onFocus={() => setShowMemberResults(true)}
                        className="bg-slate-50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all h-12"
                      />
                      {showMemberResults && memberSearch && (
                        <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-auto overflow-x-hidden border-t-4 border-t-blue-600 animate-in fade-in slide-in-from-top-2">
                          {members
                            .filter(m => 
                              (m.nama_lengkap || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
                              (m.no_anggota || '').toLowerCase().includes(memberSearch.toLowerCase())
                            )
                            .map(m => (
                              <div 
                                key={m.id} 
                                className="p-4 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 group transition-colors"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    no_anggota: m.no_anggota || '',
                                    nama_lengkap: m.nama_lengkap || ''
                                  });
                                  setMemberSearch(m.nama_lengkap || '');
                                  setShowMemberResults(false);
                                }}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-800 group-hover:text-blue-700">{m.nama_lengkap}</span>
                                  <span className="text-[10px] font-mono bg-blue-100 px-2 py-0.5 rounded-full text-blue-700 font-black">{m.no_anggota}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 font-medium">{m.jabatan || 'Anggota'} • {m.wilayah || 'Umum'}</p>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Manual Input</span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className={cn("text-[10px] font-black uppercase tracking-wider", errors.no_anggota ? "text-red-500" : "text-slate-400")}>No. Anggota</Label>
                      <Input 
                        className={cn("h-11 font-mono text-sm", errors.no_anggota ? "border-red-500 focus-visible:ring-red-500" : "")} 
                        value={formData.no_anggota} 
                        onChange={e => {
                          setFormData({...formData, no_anggota: e.target.value});
                          if (errors.no_anggota) setErrors({...errors, no_anggota: ''});
                        }} 
                        placeholder="Contoh: LSP-001" 
                      />
                      {errors.no_anggota && <p className="text-[10px] text-red-500 font-bold">{errors.no_anggota}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className={cn("text-[10px] font-black uppercase tracking-wider", errors.nama_lengkap ? "text-red-500" : "text-slate-400")}>Nama Lengkap</Label>
                      <Input 
                        className={cn("h-11 font-bold text-sm", errors.nama_lengkap ? "border-red-500 focus-visible:ring-red-500" : "")} 
                        value={formData.nama_lengkap} 
                        onChange={e => {
                          setFormData({...formData, nama_lengkap: e.target.value});
                          if (errors.nama_lengkap) setErrors({...errors, nama_lengkap: ''});
                        }} 
                        placeholder="Masukkan Nama Lengkap" 
                      />
                      {errors.nama_lengkap && <p className="text-[10px] text-red-500 font-bold">{errors.nama_lengkap}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className={cn("text-[10px] font-black uppercase tracking-wider", errors.jabatan ? "text-red-500" : "text-slate-400")}>Jabatan Struktural</Label>
                      <Input 
                        className={cn("h-11 font-bold text-sm", errors.jabatan ? "border-red-500 focus-visible:ring-red-500" : "border-blue-100 bg-blue-50/20")} 
                        value={formData.jabatan} 
                        onChange={e => {
                          setFormData({...formData, jabatan: e.target.value});
                          if (errors.jabatan) setErrors({...errors, jabatan: ''});
                        }} 
                        placeholder="Contoh: KETUA UMUM / SEKRETARIS" 
                      />
                      {errors.jabatan && <p className="text-[10px] text-red-500 font-bold">{errors.jabatan}</p>}
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-black h-14 mt-4 shadow-xl shadow-slate-100 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-xs">
                    {editingId ? 'Simpan Perubahan' : 'Masukan ke Struktur'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.map((item, idx) => {
          const profileUrl = item.foto_profile_url;

          return (
            <div key={item.id || `str-${idx}`} className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
              {/* Actions Overlay - Visible on Hover for Desktop, Always for Admin/DPP */}
              <div className="p-6 text-center">
                <div className="relative mb-4 inline-block">
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-50 border-2 border-white shadow-md overflow-hidden flex items-center justify-center relative z-10">
                    {profileUrl ? (
                      <img src={resolveUrl(profileUrl)} alt={item.nama_lengkap} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center opacity-20">
                        <User2 className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 z-20 bg-blue-600 text-white rounded-full p-1 border-2 border-white">
                    <BadgeCheck className="w-3 h-3" />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">{item.jabatan}</p>
                  <h3 className="text-md font-black text-slate-800 leading-tight">{item.nama_lengkap}</h3>
                  <p className="text-[9px] font-mono text-slate-400 font-bold uppercase">ID: {item.no_anggota || 'STR-00X'}</p>
                </div>

                {(user?.role === 'ADMIN' || user?.role === 'DPP') && (
                  <div className="mt-6 pt-4 border-t border-slate-50 flex gap-2 justify-center">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEdit(item);
                      }}
                      className="flex-1 py-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      EDIT
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteConfirmId(item.id);
                        setDeleteConfirmName(item.nama_lengkap);
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-red-600 hover:text-white rounded-lg text-slate-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {data.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-[4rem] border-4 border-white shadow-inner">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Network className="w-10 h-10 text-slate-200" />
          </div>
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Database Kosong</h3>
          <p className="text-slate-300 font-bold text-xs mt-2 italic px-10">Belum ada struktral pengurus yang diinputkan kedalam sistem.</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-[400px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-black uppercase tracking-tight">
              <AlertTriangle className="w-5 h-5" /> KONFIRMASI HAPUS
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus <span className="font-bold text-slate-900">{deleteConfirmName}</span> dari struktur organisasi? Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="font-bold">BATAL</Button>
            <Button variant="destructive" onClick={handleDelete} className="font-black bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100">HAPUS SEKARANG</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
