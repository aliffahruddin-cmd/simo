import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { apiRequest } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Image as ImageIcon, Globe, Building2, Save, Trash2, ShieldCheck } from 'lucide-react';

export default function ConsolePage() {
  const { orgName, logoUrl, exportLogoUrl, websiteUrl, refreshConfig } = useConfig();
  const [formData, setFormData] = React.useState({
    orgName: orgName,
    logoUrl: logoUrl,
    exportLogoUrl: exportLogoUrl,
    websiteUrl: websiteUrl
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setFormData({
      orgName: orgName,
      logoUrl: logoUrl,
      exportLogoUrl: exportLogoUrl,
      websiteUrl: websiteUrl
    });
  }, [orgName, logoUrl, exportLogoUrl, websiteUrl]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiRequest('/config', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      refreshConfig();
      alert('Konfigurasi sistem berhasil diperbarui!');
    } catch (err) {
      alert('Gagal menyimpan konfigurasi');
    } finally {
      setLoading(false);
    }
  };

  const [diag, setDiag] = React.useState<any>(null);

  React.useEffect(() => {
    apiRequest('/admin/diagnose').then(setDiag).catch(() => {});
  }, []);

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Console</h1>
        <p className="text-slate-500 font-medium">Konfigurasi Identitas dan Branding Aplikasi</p>
      </header>

      {diag && (
        <div className="space-y-4">
          <div className={`p-5 rounded-2xl border-l-[6px] shadow-sm flex items-start gap-5 
            ${diag.authStatus === 'working' ? 'bg-emerald-50 border-emerald-500' : 
              diag.authStatus === 'ADMIN_API_LIMITATION' ? 'bg-amber-50 border-amber-500' : 'bg-rose-50 border-rose-500'}`}>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase tracking-[2px] mb-2 flex items-center gap-2 text-slate-500">
                  <ShieldCheck className={`w-4 h-4 
                    ${diag.authStatus === 'working' ? 'text-emerald-500' : 
                      diag.authStatus === 'ADMIN_API_LIMITATION' ? 'text-amber-500' : 'text-rose-500'}`} /> 
                  Infrastructure Diagnostics
                </h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full 
                  ${diag.authStatus === 'working' ? 'bg-emerald-100 text-emerald-700' : 
                    diag.authStatus === 'ADMIN_API_LIMITATION' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                  {diag.authStatus === 'working' ? 'SYSTEMS NOMINAL' : 
                   diag.authStatus === 'ADMIN_API_LIMITATION' ? 'SANDBOX LIMITATION' : 'ATTENTION REQUIRED'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Identity Toolkit (Auth)</p>
                  <p className={`text-sm font-black 
                    ${diag.authStatus === 'working' ? 'text-emerald-600' : 
                      diag.authStatus === 'ADMIN_API_LIMITATION' ? 'text-amber-600' : 'text-rose-600'}`}>
                    {diag.authStatus === 'working' ? 'CONNECTED' : 
                     diag.authStatus === 'ADMIN_API_LIMITATION' ? 'LIMITED ACCESS' : 'DISCONNECTED'}
                  </p>
                  {diag.authErrorDetails && (
                    <div className="mt-2 p-3 bg-white/50 rounded-lg border border-rose-100">
                      <p className="text-[10px] leading-relaxed text-rose-800 font-medium">
                        {diag.authErrorDetails.message.includes("643827784442") 
                          ? "Note: Admin SDK is mismatching project ID with Host project. This is a known environment limitation. Client-side Auth will still function correctly using the API Key."
                          : diag.authErrorDetails.message}
                      </p>
                      {diag.authErrorDetails.message.includes("identitytoolkit") && (
                        <div className="space-y-2 mt-3">
                          <p className="text-[9px] text-rose-600 font-bold uppercase">Langkah Perbaikan:</p>
                          <ol className="text-[9px] text-rose-700 list-decimal list-inside space-y-1">
                            <li>Klik tombol di bawah</li>
                            <li>Pilih project: <span className="font-mono bg-rose-100 px-1">{diag.firebaseAdmin.initializedWith}</span></li>
                            <li>Klik "ENABLE"</li>
                          </ol>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="w-full h-8 text-[10px] font-black uppercase tracking-wider"
                            onClick={() => window.open(`https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${diag.firebaseAdmin.initializedWith}`, '_blank')}
                          >
                            Buka Google API Console
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Firestore Cloud Storage</p>
                  <p className={`text-sm font-black ${diag.firestoreStatus === 'working' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {diag.firestoreStatus === 'working' ? 'CONNECTED' : 'DISCONNECTED'}
                  </p>
                  {diag.firestoreErrorDetails && (
                    <div className="mt-2 p-3 bg-white/50 rounded-lg border border-rose-100">
                      <p className="text-[10px] leading-relaxed text-rose-800 font-medium">{diag.firestoreErrorDetails.message}</p>
                      {diag.firestoreErrorDetails.message.includes("permission") && (
                        <p className="mt-2 text-[9px] text-rose-600 font-bold italic uppercase">
                          Cek Project Permissions di Firebase Console.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200/50 flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Active Project</p>
                  <p className="text-[10px] font-mono font-bold text-slate-700">{diag.firebaseAdmin.projectId}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Cloud Region</p>
                  <p className="text-[10px] font-mono font-bold text-slate-700">asia-southeast1</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Environment</p>
                  <p className="text-[10px] font-mono font-bold text-slate-700">{diag.environment.nodeEnv}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="card-dense bg-white">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <Settings className="w-4 h-4 text-blue-500" /> Branding Dasar
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Nama Organisasi</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <Input 
                    value={formData.orgName} 
                    onChange={e => setFormData({...formData, orgName: e.target.value})}
                    className="pl-10 font-bold text-sm border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Website URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <Input 
                    value={formData.websiteUrl} 
                    onChange={e => setFormData({...formData, websiteUrl: e.target.value})}
                    placeholder="https://example.com"
                    className="pl-10 font-mono text-xs text-slate-600 border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Logo Organisasi</Label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input 
                        id="logo-upload-input"
                        type="file" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          const formDataToSend = new FormData();
                          formDataToSend.append('logo', file);
                          
                          setLoading(true);
                          try {
                            const res = await apiRequest('/config/logo', {
                              method: 'POST',
                              body: formDataToSend
                            });
                            
                            // Update local state first to show immediate change
                            setFormData(prev => ({
                              ...prev,
                              logoUrl: res.logoUrl
                            }));
                            
                            // Refresh global config
                            refreshConfig();
                            
                            alert('Logo berhasil diunggah!');
                          } catch (err: any) {
                            console.error('Logo upload error:', err);
                            alert(`Gagal mengunggah logo: ${err.message}`);
                          } finally {
                            setLoading(false);
                            // Reset input
                            if (e.target) e.target.value = '';
                          }
                        }}
                        className="text-xs file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium italic">Direkomendasikan file PNG/SVG background transparan.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-50">
                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Manual Logo URL</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <Input 
                      value={formData.logoUrl} 
                      onChange={e => setFormData({...formData, logoUrl: e.target.value})}
                      placeholder="https://example.com/logo.png"
                      className="pl-10 font-mono text-xs text-slate-600 border-slate-200"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="font-bold whitespace-nowrap" onClick={handleSave}>
                    Terapkan
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-50">
                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Logo Ekspor (PDF/Excel/Docx)</Label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                    {formData.exportLogoUrl ? (
                      <img src={formData.exportLogoUrl} alt="Export Logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input 
                        type="file" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          const formDataToSend = new FormData();
                          formDataToSend.append('logo', file);
                          formDataToSend.append('type', 'export');
                          
                          setLoading(true);
                          try {
                            const res = await apiRequest('/config/logo', {
                              method: 'POST',
                              body: formDataToSend
                            });
                            setFormData(prev => ({ ...prev, exportLogoUrl: res.logoUrl }));
                            refreshConfig();
                            alert('Logo Ekspor berhasil diunggah!');
                          } catch (err: any) {
                            alert(`Gagal: ${err.message}`);
                          } finally {
                            setLoading(false);
                            if (e.target) e.target.value = '';
                          }
                        }}
                        className="text-xs file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <Input 
                        value={formData.exportLogoUrl} 
                        onChange={e => setFormData({...formData, exportLogoUrl: e.target.value})}
                        placeholder="Manual URL Ekspor..."
                        className="flex-1 font-mono text-[10px] text-slate-500 border-slate-100 h-7"
                      />
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={handleSave}>Simpan</Button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium italic">Logo ini hanya muncul pada dokumen hasil ekspor.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button 
            className="w-full h-12 text-sm font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20" 
            onClick={handleSave}
            disabled={loading}
          >
            <Save className="w-4 h-4 mr-2" /> 
            {loading ? "Menyimpan..." : "Sync Konfigurasi Sistem"}
          </Button>

          <div className="card-dense bg-white mt-6">
            <div className="p-4 border-b border-slate-100 bg-rose-50/30">
              <h3 className="text-sm font-black text-rose-800 flex items-center gap-2 uppercase tracking-tight">
                <ShieldCheck className="w-4 h-4 text-rose-600" /> Konfigurasi Firebase Manual
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-[11px] text-slate-500 leading-relaxed italic">
                Jika konfigurasi otomatis gagal, tempel JSON config dari Firebase Console (Project Settings &gt; General &gt; Your apps) ke bawah ini.
              </p>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Firebase Web Config (JSON)</Label>
                <textarea 
                  className="w-full h-40 p-4 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  placeholder='{ "apiKey": "...", "projectId": "...", ... }'
                  onBlur={async (e) => {
                    if (!e.target.value.trim()) return;
                    try {
                      const json = JSON.parse(e.target.value);
                      if (confirm("Simpan konfigurasi Firebase manual ini? Ini akan memperbarui kredensial aplikasi.")) {
                        setLoading(true);
                        await apiRequest('/admin/firebase-config', {
                          method: 'POST',
                          body: JSON.stringify({ config: json })
                        });
                        alert('Konfigurasi manual berhasil disimpan. Halaman akan dimuat ulang untuk menerapkan perubahan.');
                        window.location.reload();
                      }
                    } catch (err: any) {
                      alert('JSON tidak valid! Pastikan format sesuai dengan yang ada di Firebase Console.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-700">Langkah-langkah:</p>
                <ol className="text-[10px] text-slate-500 list-decimal ml-4 space-y-1 mt-1 font-medium">
                  <li>Buka <a href="https://console.firebase.google.com/" target="_blank" className="text-blue-600 underline">Firebase Console</a></li>
                  <li>Pilih Proyek &gt; Project Settings &gt; General</li>
                  <li>Scroll ke bawah ke bagian "Your apps" &gt; pilih App Web (JSON SDK config)</li>
                  <li>Salin bagian objek <code className="bg-slate-200 px-1 rounded">{"{ ... }"}</code> dan tempel di atas.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-dense bg-slate-900 border-slate-800 text-white overflow-hidden">
            <div className="p-3 border-b border-white/5 bg-white/5">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Preview</h3>
            </div>
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-white/5 rounded border border-white/10 flex items-center justify-center mb-4 shadow-inner">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Preview" className="w-12 h-12 object-contain" />
                ) : (
                  <Building2 className="w-8 h-8 text-blue-500/50" />
                )}
              </div>
              <h3 className="text-base font-black mb-1 truncate w-full px-2 tracking-tight">{formData.orgName || "SIMAK APP"}</h3>
              <p className="text-[10px] text-blue-400 font-mono italic opacity-60 truncate w-full px-2">{formData.websiteUrl || "not-configured.io"}</p>
            </div>
          </div>

          <div className="p-4 card-dense bg-amber-50/50 border-amber-200 flex gap-3 text-amber-900">
            <Settings className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1">Global Override</p>
              <p className="text-[11px] leading-relaxed font-medium text-amber-800/80">
                Data branding ini akan muncul secara otomatis di seluruh iFrame pengurus dan template PDF resmi organisasi.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
