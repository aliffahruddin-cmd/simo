import React, { useState, useEffect } from 'react';
import { apiRequest, resolveUrl } from '../lib/api';
import { Member } from '../types';
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
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Search, Download, Trash2, Edit, ChevronRight, UserCircle, FileCheck, MapPin, Upload, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';

import * as XLSX from 'xlsx';

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  
  // Export Filters
  const [exportFilterPengurus, setExportFilterPengurus] = useState<string>('ALL');
  const [exportFilterWilayah, setExportFilterWilayah] = useState<string>('ALL');

  const { orgName, logoUrl, exportLogoUrl } = useConfig();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<any>({
    no_anggota: '',
    nik: '',
    nama_lengkap: '',
    alamat_lengkap: '',
    no_whatsapp: '',
    pengurus: 'PAC',
    wilayah: '',
    jabatan: 'Anggota',
    seksi: '',
    lain_lain: '',
    status: 'Aktif'
  });
  const [files, setFiles] = useState<{ foto_profile: File | null; foto_ektp: File | null }>({
    foto_profile: null,
    foto_ektp: null
  });

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  
  const fetchMembers = async () => {
    try {
      const data = await apiRequest('/members');
      setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nama_lengkap || formData.nama_lengkap.trim().length < 3) {
      newErrors.nama_lengkap = 'Nama lengkap minimal 3 karakter';
    }
    if (!formData.no_anggota) {
      newErrors.no_anggota = 'Nomor anggota wajib diisi';
    }
    if (!formData.wilayah) {
      newErrors.wilayah = 'Wilayah wajib diisi';
    }

    const showSensitive = user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD';
    if (showSensitive) {
      if (!formData.nik || !/^\d{16}$/.test(formData.nik)) {
        newErrors.nik = 'NIK harus 16 digit angka';
      }
      if (!formData.no_whatsapp || !/^(08|\+62)\d{8,15}$/.test(formData.no_whatsapp)) {
        newErrors.no_whatsapp = 'Format WhatsApp tidak valid (08... atau +62...)';
      }
      if (!formData.alamat_lengkap || formData.alamat_lengkap.trim().length < 5) {
        newErrors.alamat_lengkap = 'Alamat minimal 5 karakter';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    const fd = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== undefined && formData[key] !== null) {
        fd.append(key, formData[key]);
      }
    });
    if (files.foto_profile) fd.append('foto_profile', files.foto_profile);
    if (files.foto_ektp) fd.append('foto_ektp', files.foto_ektp);

    try {
      if (selectedMember && isFormOpen) {
        // Edit mode
        await apiRequest(`/members/${selectedMember.id}`, {
          method: 'PUT',
          body: fd
        });
        alert('Data anggota berhasil diperbarui!');
      } else {
        // Create mode
        await apiRequest('/members', {
          method: 'POST',
          body: fd
        });
        alert('Data anggota berhasil disimpan!');
      }
      setIsFormOpen(false);
      setSelectedMember(null);
      fetchMembers();
      // Reset
      setFormData({
        no_anggota: '', nik: '', nama_lengkap: '', alamat_lengkap: '', no_whatsapp: '',
        pengurus: 'PAC', wilayah: '', jabatan: 'Anggota', seksi: '', lain_lain: '', status: 'Aktif'
      });
      setFiles({ foto_profile: null, foto_ektp: null });
      setErrors({});
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (member: any) => {
    setSelectedMember(member);
    setErrors({});
    setFormData({
      no_anggota: member.no_anggota || '',
      nik: member.nik || '',
      nama_lengkap: member.nama_lengkap || '',
      alamat_lengkap: member.alamat_lengkap || '',
      no_whatsapp: member.no_whatsapp || '',
      pengurus: member.pengurus || 'PAC',
      wilayah: member.wilayah || '',
      jabatan: member.jabatan || 'Anggota',
      seksi: member.seksi || '',
      lain_lain: member.lain_lain || '',
      status: member.status || 'Aktif'
    });
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    console.log('DEBUG: handleDelete called with ID:', id);
    
    try {
      console.log('DEBUG: Sending DELETE request to /members/' + id);
      const res = await apiRequest(`/members/${id}`, { method: 'DELETE' });
      console.log('DEBUG: DELETE success:', res);
      alert('Data anggota berhasil dihapus');
      setDeleteConfirmId(null);
      fetchMembers();
    } catch (err: any) {
      console.error('DEBUG: DELETE error:', err);
      alert(`Gagal menghapus data: ${err.message}`);
    }
  };

  const filteredMembers = members.filter((m: any) => {
    const matchesSearch = (m.nama_lengkap || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (m.no_anggota || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPengurus = exportFilterPengurus === 'ALL' || m.pengurus === exportFilterPengurus;
    const matchesWilayah = exportFilterWilayah === 'ALL' || m.wilayah === exportFilterWilayah;

    return matchesSearch && matchesPengurus && matchesWilayah;
  });

  const loadImage = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error("Canvas draw failed:", e);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.error("Image load failed for URL:", url);
        resolve(null);
      };
      // Handle relative URLs
      const absoluteUrl = url.startsWith('/') ? window.location.origin + url : url;
      img.src = absoluteUrl;
    });
  };

  const exportPDF = async (member: any) => {
    try {
      const doc = new jsPDF();
      const currentLogo = exportLogoUrl || logoUrl;

      if (currentLogo) {
        const logoBase64 = await loadImage(currentLogo);
        if (logoBase64) {
          try {
            doc.setFillColor(255, 255, 255);
            doc.rect(20, 10, 30, 30, 'F');
            doc.addImage(logoBase64, 'PNG', 20, 10, 30, 30);
          } catch (e) {
            console.error("Failed to add logo to PDF:", e);
          }
        }
      }

    // Header (Shifted right to accommodate logo)
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(orgName, 55, 20);
    doc.setFontSize(10);
    doc.text("SISTEM INFORMASI MANAJEMEN ANGGOTA", 55, 26);

    doc.setDrawColor(200);
    doc.line(20, 45, 190, 45);

    // Member Details
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("KARTU DATA ANGGOTA", 20, 60);
    
    doc.setFontSize(12);
    const fields = [
      ["Nomor Anggota", member.no_anggota],
      ...(user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD' ? [
        ["NIK", member.nik],
        ["No. Whatsapp", member.no_whatsapp],
        ["Alamat", member.alamat_lengkap]
      ] : []),
      ["Nama Lengkap", member.nama_lengkap],
      ["Jabatan", member.jabatan],
      ["Pengurus", member.pengurus],
      ["Wilayah", member.wilayah],
      ["Status", member.status]
    ];

    let y = 75;
    fields.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${value}`, 70, y);
      y += 10;
    });

    doc.save(`Member_${member.no_anggota}.pdf`);
    } catch (e: any) {
      console.error("Export PDF error:", e);
      alert("Gagal mengekspor PDF: " + e.message);
    }
  };

  const handlePreview = (member: Member) => {
    setSelectedMember(member);
    setIsPreviewOpen(true);
  };

  const handleExportExcel = () => {
    try {
      const exportData = filteredMembers.map(m => ({
        'No Anggota': m.no_anggota,
        'NIK': user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD' ? m.nik : '***',
        'Nama Lengkap': m.nama_lengkap,
        'Alamat': user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD' ? m.alamat_lengkap : '***',
        'No WhatsApp': user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD' ? m.no_whatsapp : '***',
        'Pengurus': m.pengurus,
        'Wilayah': m.wilayah,
        'Jabatan': m.jabatan,
        'Seksi': m.seksi,
        'Status': m.status
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Anggota");
      XLSX.writeFile(wb, `Data_Anggota_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e: any) {
      console.error("Export Excel error:", e);
      alert("Gagal mengekspor Excel: " + e.message);
    }
  };

  const handleExportDocx = (format: string = 'docx') => {
    const token = localStorage.getItem('token');
    let url = `/api/members/export?token=${token}&format=${format}`;
    if (exportFilterPengurus !== 'ALL') url += `&pengurus=${exportFilterPengurus}`;
    if (exportFilterWilayah !== 'ALL') url += `&wilayah=${exportFilterWilayah}`;
    window.location.href = url;
  };

  const handleExportPDFList = async () => {
    try {
      const doc = new jsPDF();
      const currentLogo = exportLogoUrl || logoUrl;

      if (currentLogo) {
        const logoBase64 = await loadImage(currentLogo);
        if (logoBase64) {
          try {
            doc.setFillColor(255, 255, 255);
            doc.rect(20, 10, 25, 25, 'F');
            doc.addImage(logoBase64, 'PNG', 20, 10, 25, 25);
          } catch (e) {
            console.error("Failed to add image to PDF list", e);
          }
        }
      }

    // Header (Shifted right)
    doc.setFontSize(18);
    doc.text(orgName, 50, 20);
    doc.setFontSize(10);
    doc.text("LAPORAN DATA ANGGOTA - " + new Date().toLocaleDateString(), 50, 26);

    doc.line(20, 38, 190, 38);

    const tableHeaders = ['No Anggota', 'Nama Lengkap', 'Wilayah', 'Jabatan', 'Status'];
    const showInfoKontak = user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD';
    
    if (showInfoKontak) {
      tableHeaders.push('Whatsapp');
    }

    const tableData = filteredMembers.map(m => {
      const row = [
        m.no_anggota,
        m.nama_lengkap,
        m.wilayah,
        m.jabatan,
        m.status
      ];
      if (showInfoKontak) {
        row.push(m.no_whatsapp);
      }
      return row;
    });

    autoTable(doc, {
      startY: 45,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold' }
    });

    doc.save(`Data_Anggota_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e: any) {
      console.error("Export PDF List error:", e);
      alert("Gagal mengekspor Daftar PDF: " + e.message);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      ['no_anggota', 'nik', 'nama_lengkap', 'alamat_lengkap', 'no_whatsapp', 'pengurus', 'wilayah', 'jabatan', 'seksi', 'status']
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Anggota.xlsx");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          alert('File kosong atau format tidak sesuai');
          return;
        }

        setImportData(data);
        setIsImportOpen(true);
      } catch (err) {
        alert('Gagal membaca file: ' + err);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const confirmImport = async () => {
    try {
      setLoading(true);
      await apiRequest('/members/bulk', {
        method: 'POST',
        body: { members: importData }
      });
      alert(`Berhasil mengimpor ${importData.length} data anggota!`);
      setIsImportOpen(false);
      setImportData([]);
      fetchMembers();
    } catch (err: any) {
      alert('Gagal impor: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Old implementation replaced by handleImportFile + confirmImport
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Manajemen Anggota</h1>
          <p className="text-slate-500">Data Anggota Organisasi</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Cari..." 
              className="pl-10 w-full border-slate-200"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Select value={exportFilterPengurus} onValueChange={setExportFilterPengurus}>
              <SelectTrigger className="w-[120px] h-9 text-xs font-bold">
                <SelectValue placeholder="Pengurus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Level</SelectItem>
                <SelectItem value="DPP">DPP</SelectItem>
                <SelectItem value="DPD">DPD</SelectItem>
                <SelectItem value="DPC">DPC</SelectItem>
                <SelectItem value="PAC">PAC</SelectItem>
              </SelectContent>
            </Select>

            <Select value={exportFilterWilayah} onValueChange={setExportFilterWilayah}>
              <SelectTrigger className="w-[120px] h-9 text-xs font-bold">
                <SelectValue placeholder="Wilayah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Wilayah</SelectItem>
                {[...new Set(members.map(m => m.wilayah))].filter(Boolean).map(w => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              size="sm" 
              className="gap-2 font-bold shrink-0 shadow-md h-9 bg-emerald-600 hover:bg-emerald-700 text-white" 
              onClick={() => document.getElementById('import-input')?.click()}
            >
              <Upload className="w-3.5 h-3.5" /> Impor Data
            </Button>
            <input 
              id="import-input" 
              type="file" 
              accept=".xlsx,.csv" 
              className="hidden" 
              onChange={handleImportFile} 
            />
            <Button variant="outline" size="sm" className="gap-2 font-bold shrink-0 shadow-sm h-9" onClick={handleExportPDFList}>
              <Download className="w-3.5 h-3.5" /> PDF
            </Button>
            
            {(user?.role === 'ADMIN' || user?.role === 'DPP') && (
              <>
                <Button variant="outline" size="sm" className="gap-2 font-bold shrink-0 shadow-sm h-9" onClick={handleExportExcel}>
                  <Download className="w-3.5 h-3.5" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-2 font-bold shrink-0 shadow-sm h-9" onClick={() => handleExportDocx('docx')}>
                  <FileCheck className="w-3.5 h-3.5" /> Docx
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => setIsFormOpen(true)} className="gap-2 font-bold shrink-0 shadow-lg h-9">
              <UserPlus className="w-3.5 h-3.5" /> Tambah
            </Button>
          </div>
        </div>
      </div>

      <div className="card-dense">
        <table className="table-dense">
          <thead>
            <tr>
              <th>Anggota</th>
              {(user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD') && <th>Info Kontak</th>}
              <th>Level / Wilayah</th>
              <th>Jabatan</th>
              <th>Status</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m: any) => (
              <tr 
                key={m.id} 
                className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                onClick={() => handlePreview(m)}
              >
                <td className="min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                      {m.foto_profile_url ? (
                        <img src={resolveUrl(m.foto_profile_url)} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 leading-tight">{m.nama_lengkap}</p>
                      <p className="text-[10px] font-mono text-slate-400">{m.no_anggota}</p>
                    </div>
                  </div>
                </td>
                {(user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD') && (
                  <td>
                    <p className="text-xs font-bold text-slate-600">{m.no_whatsapp}</p>
                    <p className="text-[10px] text-slate-400 truncate w-32">{m.alamat_lengkap}</p>
                  </td>
                )}
                <td>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[9px] px-1.5 py-0">
                    {m.pengurus}
                  </Badge>
                  <p className="text-[9px] text-slate-500 mt-0.5 flex items-center gap-1 font-bold italic">
                    <MapPin className="w-2.5 h-2.5" /> {m.wilayah}
                  </p>
                </td>
                <td>
                  <span className="text-xs font-bold text-slate-700">{m.jabatan}</span>
                  {m.seksi && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{m.seksi}</p>}
                </td>
                <td>
                  <Badge className={cn(
                    "px-1.5 py-0 text-[10px] uppercase font-black tracking-tighter",
                    m.status === 'Aktif' ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-red-50 text-red-600 hover:bg-red-100"
                  )}>
                    {m.status}
                  </Badge>
                </td>
                <td className="text-right p-0">
                  <div className="flex justify-end gap-1 px-3 py-1">
                    <button 
                      type="button"
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-90 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(m);
                      }}
                      title="Lihat Detail"
                    >
                      <UserCircle className="w-5 h-5" />
                    </button>
                    <button 
                      type="button"
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(m);
                      }}
                      disabled={m.pengurus === 'DPP' && (user?.role !== 'ADMIN' && user?.role !== 'DPP')}
                      title={m.pengurus === 'DPP' && (user?.role !== 'ADMIN' && user?.role !== 'DPP') ? "Hanya DPP/Admin yang dapat mengubah data DPP" : "Ubah Data"}
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button 
                      type="button"
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all active:scale-90 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportPDF(m);
                      }}
                      title="Unduh PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      type="button"
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('DEBUG: Trash button clicked for member:', m.nama_lengkap);
                        setDeleteConfirmId(m.id);
                        setDeleteConfirmName(m.nama_lengkap);
                      }}
                      disabled={m.pengurus === 'DPP' && (user?.role !== 'ADMIN' && user?.role !== 'DPP')}
                      title={m.pengurus === 'DPP' && (user?.role !== 'ADMIN' && user?.role !== 'DPP') ? "Hanya DPP/Admin yang dapat menghapus data DPP" : "Hapus Data"}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => {
        setIsFormOpen(open);
        if (!open) {
          setSelectedMember(null);
          setErrors({});
        }
      }}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{selectedMember ? 'Ubah Data Anggota' : 'Formulir Anggota Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-primary uppercase border-b pb-1">Identitas Dasar</h3>
                <div className="space-y-2">
                  <Label className={errors.no_anggota ? "text-red-500" : ""}>Nomor Anggota (Manual)</Label>
                  <Input 
                    value={formData.no_anggota} 
                    onChange={e => {
                      setFormData({...formData, no_anggota: e.target.value});
                      if (errors.no_anggota) setErrors({...errors, no_anggota: ''});
                    }} 
                    placeholder="Contoh: 001/DPP/2024"
                    className={errors.no_anggota ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errors.no_anggota && <p className="text-[10px] text-red-500 font-bold">{errors.no_anggota}</p>}
                </div>
                {/* Sensitive fields restricted to ADMIN, DPP, DPD */}
                {(user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD') && (
                  <div className="space-y-2">
                    <Label className={errors.nik ? "text-red-500" : ""}>NIK (KTP)</Label>
                    <Input 
                      value={formData.nik} 
                      onChange={e => {
                        setFormData({...formData, nik: e.target.value});
                        if (errors.nik) setErrors({...errors, nik: ''});
                      }}
                      className={errors.nik ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.nik && <p className="text-[10px] text-red-500 font-bold">{errors.nik}</p>}
                  </div>
                )}
                <div className="space-y-2">
                  <Label className={errors.nama_lengkap ? "text-red-500" : ""}>Nama Lengkap</Label>
                  <Input 
                    value={formData.nama_lengkap} 
                    onChange={e => {
                      setFormData({...formData, nama_lengkap: e.target.value});
                      if (errors.nama_lengkap) setErrors({...errors, nama_lengkap: ''});
                    }}
                    className={errors.nama_lengkap ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errors.nama_lengkap && <p className="text-[10px] text-red-500 font-bold">{errors.nama_lengkap}</p>}
                </div>
                {(user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD') && (
                  <div className="space-y-2">
                    <Label className={errors.alamat_lengkap ? "text-red-500" : ""}>Alamat Lengkap</Label>
                    <Input 
                      value={formData.alamat_lengkap} 
                      onChange={e => {
                        setFormData({...formData, alamat_lengkap: e.target.value});
                        if (errors.alamat_lengkap) setErrors({...errors, alamat_lengkap: ''});
                      }}
                      className={errors.alamat_lengkap ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.alamat_lengkap && <p className="text-[10px] text-red-500 font-bold">{errors.alamat_lengkap}</p>}
                  </div>
                )}
                {(user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD') && (
                  <div className="space-y-2">
                    <Label className={errors.no_whatsapp ? "text-red-500" : ""}>No. Whatsapp</Label>
                    <Input 
                      value={formData.no_whatsapp} 
                      onChange={e => {
                        setFormData({...formData, no_whatsapp: e.target.value});
                        if (errors.no_whatsapp) setErrors({...errors, no_whatsapp: ''});
                      }}
                      placeholder="08xxxxxxxxxx"
                      className={errors.no_whatsapp ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.no_whatsapp && <p className="text-[10px] text-red-500 font-bold">{errors.no_whatsapp}</p>}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-sm text-primary uppercase border-b pb-1">Struktur & Lokasi</h3>
                <div className="space-y-2">
                  <Label>Pengurus</Label>
                  <Select value={formData.pengurus} onValueChange={v => setFormData({...formData, pengurus: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(user?.role === 'ADMIN' || user?.role === 'DPP') && <SelectItem value="DPP">DPP (Pusat)</SelectItem>}
                      <SelectItem value="DPD">DPD (Provinsi)</SelectItem>
                      <SelectItem value="DPC">DPC (Kab/Kota)</SelectItem>
                      <SelectItem value="PAC">PAC (Kecamatan)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className={errors.wilayah ? "text-red-500" : ""}>Wilayah (Manual)</Label>
                  <Input 
                    value={formData.wilayah} 
                    onChange={e => {
                      setFormData({...formData, wilayah: e.target.value});
                      if (errors.wilayah) setErrors({...errors, wilayah: ''});
                    }} 
                    placeholder="Input Wilayah..." 
                    className={errors.wilayah ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errors.wilayah && <p className="text-[10px] text-red-500 font-bold">{errors.wilayah}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Jabatan</Label>
                  <Select value={formData.jabatan} onValueChange={v => setFormData({...formData, jabatan: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pengurus">Pengurus</SelectItem>
                      <SelectItem value="Ketua Umum">Ketua Umum</SelectItem>
                      <SelectItem value="Wakil Ketua Umum">Wakil Ketua Umum</SelectItem>
                      <SelectItem value="Sekretaris Jendral">Sekretaris Jendral</SelectItem>
                      <SelectItem value="Bendahara Umum">Bendahara Umum</SelectItem>
                      <SelectItem value="Ketua">Ketua</SelectItem>
                      <SelectItem value="Wakil Ketua">Wakil Ketua</SelectItem>
                      <SelectItem value="Sekretaris">Sekretaris</SelectItem>
                      <SelectItem value="Bendahara">Bendahara</SelectItem>
                      <SelectItem value="Anggota">Anggota</SelectItem>
                      <SelectItem value="Komandan Gardapati">Komandan Gardapati</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Seksi (Optional)</Label>
                  <Input value={formData.seksi} onChange={e => setFormData({...formData, seksi: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-sm text-primary uppercase border-b pb-1">Lampiran Media</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Foto Profil</Label>
                  <Input type="file" accept="image/*" onChange={e => setFiles({...files, foto_profile: e.target.files?.[0] || null})} />
                </div>
                <div className="space-y-2">
                  <Label>Foto E-KTP</Label>
                  <Input type="file" accept="image/*" onChange={e => setFiles({...files, foto_ektp: e.target.files?.[0] || null})} />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full font-black text-lg h-12 shadow-xl">SIMPAN DATA ANGGOTA</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Pratinjau Impor Data Anggota
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto py-4">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 leading-relaxed">
                <p className="font-bold mb-1">PENTING:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Pastikan kolom header sesuai dengan template.</li>
                  <li>Sistem akan mendeteksi data duplikat berdasarkan NIK (jika ada).</li>
                  <li>Data di bawah adalah pratinjau dari file yang Anda unggah ({importData.length} baris).</li>
                </ul>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2 text-left font-bold">No. Anggota</th>
                    <th className="p-2 text-left font-bold">NIK</th>
                    <th className="p-2 text-left font-bold">Nama Lengkap</th>
                    <th className="p-2 text-left font-bold">Wilayah</th>
                    <th className="p-2 text-left font-bold">Jabatan</th>
                    <th className="p-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importData.slice(0, 50).map((row: any, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2">{row.no_anggota}</td>
                      <td className="p-2">{row.nik}</td>
                      <td className="p-2 font-bold">{row.nama_lengkap}</td>
                      <td className="p-2">{row.wilayah}</td>
                      <td className="p-2">{row.jabatan}</td>
                      <td className="p-2">
                        <Badge className="text-[9px] px-1 py-0">{row.status || 'Aktif'}</Badge>
                      </td>
                    </tr>
                  ))}
                  {importData.length > 50 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 font-bold italic">
                        ... dan {importData.length - 50} baris lainnya
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t gap-2">
            <Button variant="outline" onClick={downloadTemplate} className="gap-2 font-bold mr-auto">
              <Download className="w-4 h-4" /> Unduh Template
            </Button>
            <Button variant="ghost" onClick={() => setIsImportOpen(false)} className="font-bold">BATAL</Button>
            <Button onClick={confirmImport} className="font-black bg-primary px-8 shadow-xl" disabled={loading}>
              {loading ? 'MEMPROSES...' : `IMPOR SEKARANG (${importData.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-2xl bg-white p-0 overflow-y-auto max-h-[95vh] border-none shadow-2xl">
          {selectedMember && (
            <div className="flex flex-col">
              <div className="bg-primary p-6 text-white relative">
                <div className="flex items-center gap-4 mb-4">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-lg bg-white/20 p-1" />}
                  <div>
                    <h2 className="text-xl font-black leading-tight uppercase">{orgName}</h2>
                    <p className="text-xs text-primary-foreground/70 font-bold tracking-widest uppercase">Member Information System</p>
                  </div>
                </div>
                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-bl-[100px]" />
              </div>
              
              <div className="p-8">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="shrink-0 flex flex-col items-center gap-4">
                    <div className="w-40 h-52 bg-slate-100 rounded-2xl border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                      {selectedMember.foto_profile_url ? (
                        <img src={resolveUrl(selectedMember.foto_profile_url)} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-20 h-20 text-slate-300" />
                      )}
                    </div>
                    <Badge variant="outline" className={cn(
                      "px-4 py-1 font-black",
                      selectedMember.status === 'Aktif' ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-red-600 border-red-200 bg-red-50"
                    )}>
                      {selectedMember.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nama Lengkap</p>
                      <p className="text-2xl font-black text-slate-900 leading-tight">{selectedMember.nama_lengkap}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <InfoItem label="Nomor Anggota" value={selectedMember.no_anggota} />
                      {(user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD') && (
                        <>
                          <InfoItem label="NIK" value={selectedMember.nik} />
                          <InfoItem label="No. Whatsapp" value={selectedMember.no_whatsapp} />
                        </>
                      )}
                      <InfoItem label="Jabatan" value={selectedMember.jabatan} />
                      <InfoItem label="Pengurus" value={selectedMember.pengurus} />
                      <InfoItem label="Wilayah" value={selectedMember.wilayah} />
                    </div>

                    {(user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD') && (
                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Alamat Lengkap</p>
                        <p className="text-sm font-medium text-slate-600 italic">"{selectedMember.alamat_lengkap}"</p>
                      </div>
                    )}
                  </div>
                </div>

                 {(user?.role === 'ADMIN' || user?.role === 'DPP' || user?.role === 'DPD') && selectedMember.foto_ektp_url && (
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Lampiran E-KTP</p>
                    <div className="relative group">
                      <img src={resolveUrl(selectedMember.foto_ektp_url)} alt="KTP" className="w-full h-48 object-cover rounded-xl border border-slate-200 grayscale hover:grayscale-0 transition-all duration-300 shadow-sm" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                        <Button variant="secondary" size="sm" onClick={() => window.open(resolveUrl(selectedMember.foto_ektp_url), '_blank')}>Lihat Resolusi Penuh</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Printed via SIMAK System • {new Date().toLocaleString()}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(false)}>Tutup</Button>
                  <Button size="sm" onClick={() => exportPDF(selectedMember)}><Download className="w-4 h-4 mr-2" /> Unduh Data</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-[400px] bg-white border-red-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-black uppercase tracking-tight">
              <AlertTriangle className="w-5 h-5" /> Konfirmasi Hapus Anggota
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data anggota <span className="font-bold text-slate-900">{deleteConfirmName}</span>? Tindakan ini tidak dapat dibatalkan dan semua data terkait akan hilang.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="font-bold">BATAL</Button>
            <Button variant="destructive" onClick={handleDelete} className="font-black bg-red-600 hover:bg-red-700 shadow-xl shadow-red-100">HAPUS ANGGOTA</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-bold text-slate-800 break-words">{value}</p>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
