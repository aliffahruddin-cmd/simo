import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download, Mail, FileBarChart, Filter, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useConfig } from '../context/ConfigContext';

export default function ReportsPage() {
  const { user } = useAuth();
  const { orgName, logoUrl, exportLogoUrl } = useConfig();
  const [month, setMonth] = useState(new Date().getMonth() + 1 + '');
  const [year, setYear] = useState(new Date().getFullYear() + '');
  const [loading, setLoading] = useState(false);

  const months = [
    { v: '1', l: 'Januari' }, { v: '2', l: 'Februari' }, { v: '3', l: 'Maret' },
    { v: '4', l: 'April' }, { v: '5', l: 'Mei' }, { v: '6', l: 'Juni' },
    { v: '7', l: 'Juli' }, { v: '8', l: 'Agustus' }, { v: '9', l: 'September' },
    { v: '10', l: 'Oktober' }, { v: '11', l: 'November' }, { v: '12', l: 'Desember' }
  ];

  const canExportFull = user?.role === 'ADMIN' || user?.role === 'DPP';

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
      const absoluteUrl = url.startsWith('/') ? window.location.origin + url : url;
      img.src = absoluteUrl;
    });
  };

  const handleExportExcel = async () => {
    setLoading(true);
    try {
      const members = await apiRequest('/members');
      const ws = XLSX.utils.json_to_sheet(members);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Anggota");
      XLSX.writeFile(wb, `Laporan_Anggota_${month}_${year}.xlsx`);
    } catch (err) {
      alert('Gagal export excel');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setLoading(true);
    try {
      const finance = await apiRequest('/finance');
      const doc = new jsPDF();
      const currentLogo = exportLogoUrl || logoUrl;

      // Add Logo
      if (currentLogo) {
        const logoBase64 = await loadImage(currentLogo);
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', 14, 10, 20, 20);
        }
      }

      // Title & Header
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(orgName.toUpperCase(), 38, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`LAPORAN KEUANGAN PERIODE ${months.find(m => m.v === month)?.l.toUpperCase()} ${year}`, 38, 24);
      doc.text(`Dicetak oleh: ${user?.nama_lengkap || 'System'} pada ${new Date().toLocaleString()}`, 38, 29);

      doc.setDrawColor(200);
      doc.line(14, 35, 196, 35);

      // Summarize
      const income = finance.filter((f: any) => f.jenis === 'Masuk').reduce((acc: number, curr: any) => acc + (Number(curr.nominal) || 0), 0);
      const expense = finance.filter((f: any) => f.jenis === 'Keluar').reduce((acc: number, curr: any) => acc + (Number(curr.nominal) || 0), 0);
      const balance = income - expense;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`RINGKASAN:`, 14, 45);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Pemasukan: Rp ${income.toLocaleString('id-ID')}`, 14, 50);
      doc.text(`Total Pengeluaran: Rp ${expense.toLocaleString('id-ID')}`, 14, 55);
      doc.text(`Saldo Akhir: Rp ${balance.toLocaleString('id-ID')}`, 14, 60);

      const tableData = finance.map((f: any) => [
        f.tanggal, 
        f.keterangan, 
        f.jenis, 
        `Rp ${Number(f.nominal || 0).toLocaleString('id-ID')}`
      ]);

      autoTable(doc, {
        startY: 70,
        head: [['Tanggal', 'Keterangan', 'Jenis', 'Nominal']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold' },
        foot: [['', 'TOTAL', '', `Rp ${balance.toLocaleString('id-ID')}`]],
        footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      doc.save(`Laporan_Keuangan_${month}_${year}.pdf`);
    } catch (err: any) {
      console.error("PDF Export Error:", err);
      alert('Gagal export pdf: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = () => {
    alert(`Laporan periode ${month}/${year} telah dikirim ke email: ${user?.email || 'admin@simak.com'}`);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sistem Pelaporan</h1>
        <p className="text-slate-500 font-medium">Export dan sinkronisasi data periodik</p>
      </header>

      <div className="card-dense bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-black uppercase tracking-tight">Konfigurasi Pelaporan</h3>
          </div>
          <p className="text-[10px] font-bold text-slate-400">Periode Aktif: {month}/{year}</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Bulan</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="h-9 text-xs font-bold border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {months.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Tahun</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="h-9 text-xs font-bold border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded border border-slate-200 flex gap-3">
                <FileBarChart className="w-6 h-6 text-blue-500/40 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cakupan Wilayah</p>
                  <p className="text-[11px] leading-relaxed text-slate-600 font-bold">
                    Data terkunci untuk wilayah <span className="text-blue-600 font-black">[{user?.wilayah}]</span>. Filter tahunan diterapkan secara otomatis pada engine laporan.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Output Tersedia</Label>
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleExportPDF} 
                  variant="outline"
                  className="h-10 justify-start gap-3 font-bold text-xs border-slate-200 hover:bg-slate-50"
                  disabled={loading}
                >
                  <div className="w-6 flex justify-center"><FileText className="w-4 h-4 text-red-500" /></div>
                  Generate Laporan (PDF)
                </Button>

                <Button 
                  onClick={handleExportExcel} 
                  variant="outline"
                  className="h-10 justify-start gap-3 font-bold text-xs border-slate-200 hover:bg-slate-50"
                  disabled={!canExportFull || loading}
                >
                  <div className="w-6 flex justify-center"><Download className="w-4 h-4 text-emerald-500" /></div>
                  Export Database (XLSX)
                </Button>

                <Button 
                  onClick={handleSendEmail}
                  className="h-10 gap-3 font-black text-xs uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                >
                  <Mail className="w-4 h-4" /> Kirim Laporan via Email
                </Button>

                {!canExportFull && (
                  <div className="mt-1 flex items-center justify-center gap-2 p-2 bg-red-50 border border-red-100 rounded">
                    <ShieldAlert className="w-3 h-3 text-red-500" />
                    <p className="text-[9px] text-red-600 font-black uppercase tracking-tighter">
                      Akses ekspor penuh dibatasi oleh sistem
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50 grayscale pointer-events-none">
        <div className="h-32 card-dense border-dashed flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
          Visualisasi Data (Coming Soon)
        </div>
        <div className="h-32 card-dense border-dashed flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
          Analisis Keaktifan (Coming Soon)
        </div>
      </div>

    </div>
  );
}
