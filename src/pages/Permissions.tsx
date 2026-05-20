import React from 'react';
import { useConfig } from '../context/ConfigContext';
import { apiRequest } from '../lib/api';
import { Shield, Check, X, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PermissionsPage() {
  const { permissions, refreshConfig } = useConfig();
  const [loading, setLoading] = React.useState(false);

  const roles = ['ADMIN', 'DPP', 'DPD', 'DPC', 'PAC'];
  const menus = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'members', label: 'Data Anggota' },
    { key: 'structure', label: 'Struktur Organisasi' },
    { key: 'finance', label: 'Keuangan' },
    { key: 'users', label: 'Manajemen User' },
    { key: 'reports', label: 'Laporan PDF/Excel' },
    { key: 'console', label: 'System Console' },
    { key: 'permissions', label: 'Manajemen Hak Akses' },
  ];

  const handleToggle = async (role: string, menu_key: string, current: number) => {
    setLoading(true);
    try {
      await apiRequest('/permissions', {
        method: 'POST',
        body: { role, menu_key, is_allowed: current === 1 ? 0 : 1 }
      });
      refreshConfig();
    } catch (err: any) {
      alert(`Gagal merubah hak akses: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Manajemen Hak Akses</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Konfigurasi menu untuk setiap tingkatan pengurus</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshConfig()} className="gap-2 font-bold h-9">
          <RefreshCw className={loading ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} /> Segarkan
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-tight">Role & Permission Matrix</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400">Tentukan menu mana saja yang dapat diakses oleh masing-masing role.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100/50 border-b border-slate-100">
                    <th className="text-left py-4 px-6 font-black text-slate-500 text-[10px] uppercase tracking-widest w-64">Nama Menu</th>
                    {roles.map(role => (
                      <th key={role} className="text-center py-4 px-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">{role}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {menus.map((menu) => (
                    <tr key={menu.key} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 text-xs">{menu.label}</span>
                          <span className="text-[9px] text-slate-400 font-medium">Path: /{menu.key === 'dashboard' ? '' : menu.key}</span>
                        </div>
                      </td>
                      {roles.map(role => {
                        const perm = permissions.find(p => p.role === role && p.menu_key === menu.key);
                        const isAllowed = perm ? perm.is_allowed === 1 : false;
                        
                        // Admin cannot disable dashboard and permissions for themselves
                        const isProtected = role === 'ADMIN' && (menu.key === 'dashboard' || menu.key === 'permissions' || menu.key === 'console');

                        return (
                          <td key={`${role}-${menu.key}`} className="py-4 px-4 text-center">
                            <div className="flex justify-center">
                              <Switch 
                                checked={isAllowed} 
                                onCheckedChange={() => handleToggle(role, menu.key, perm?.is_allowed || 0)}
                                disabled={loading || isProtected}
                                className={isAllowed ? "data-[state=checked]:bg-emerald-500" : "data-[state=unchecked]:bg-slate-200"}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
          <div className="w-10 h-10 bg-blue-100/50 rounded-lg flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="text-xs font-black text-blue-900 uppercase tracking-tight">Catatan Penting</h4>
            <p className="text-[10px] text-blue-700 font-medium mt-1 leading-relaxed">
              Perubahan pada hak akses akan langsung berdampak pada menu navigasi pengguna yang sedang aktif setelah halaman dimuat ulang. 
              Beberapa menu sistem untuk role ADMIN dikunci untuk mencegah kegagalan akses sistem menyeluruh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
