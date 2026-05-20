import React from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { 
  Users, 
  LayoutDashboard, 
  UserPlus, 
  ClipboardList, 
  Wallet, 
  FileText, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Heart,
  Network,
  ShieldCheck,
  Lock,
  Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DonateModal } from './DonateModal';
import { format } from 'date-fns';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { orgName, logoUrl, permissions } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEmbedded = searchParams.get('embed') === 'true';
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(window.innerWidth > 1024 && !isEmbedded);
  const [isDonateOpen, setIsDonateOpen] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  const handleNavItemClick = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', key: 'dashboard' },
    { name: 'Data Anggota', icon: UserPlus, path: '/members', key: 'members' },
    { name: 'Struktur Organisasi', icon: Network, path: '/structure', key: 'structure' },
    { name: 'Keuangan', icon: Wallet, path: '/finance', key: 'finance' },
    { name: 'Manajemen User', icon: Users, path: '/users', key: 'users' },
    { name: 'Laporan PDF/Excel', icon: FileText, path: '/reports', key: 'reports' },
    { name: 'Hak Akses', icon: Lock, path: '/permissions', key: 'permissions' },
    { name: 'Backup & Restore', icon: Server, path: '/maintenance', key: 'maintenance' },
    { name: 'System Console', icon: Settings, path: '/console', key: 'console' },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (!user) return false;
    // Admin always sees everything, but let's respect the database anyway
    if (user.role === 'ADMIN' && item.key === 'permissions') return true; // Safety for admin
    
    const perm = permissions.find(p => p.role === user.role && p.menu_key === item.key);
    return perm ? perm.is_allowed === 1 : false;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex overflow-hidden font-sans text-slate-900 relative">
      {/* Backdrop for fixed sidebar */}
      {isEmbedded && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar Navigation */}
      <aside 
        className={cn(
          "bg-[#1e293b] text-slate-300 flex flex-col shrink-0 transition-all duration-300 ease-in-out z-50",
          isSidebarOpen ? "w-60" : "w-16",
          isEmbedded && !isSidebarOpen && "w-0 overflow-hidden",
          isEmbedded && isSidebarOpen && "fixed inset-y-0 left-0 shadow-2xl"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-700/50 shrink-0 bg-[#0f172a]/40">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center shadow-inner shrink-0 group overflow-hidden relative transition-all duration-300",
              !isSidebarOpen && "w-10 h-10"
            )}>
              {logoUrl && logoUrl !== "" ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-10 h-10 object-contain transition-transform duration-500 group-hover:scale-105" 
                />
              ) : (
                <ShieldCheck className="w-6 h-6 text-red-600 group-hover:scale-110 transition-transform duration-500 relative z-10" />
              )}
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="font-black text-white text-[11px] leading-tight tracking-tighter truncate uppercase italic">SANGIDU PUTIH</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1 h-1 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-[9px] text-red-500 font-bold uppercase tracking-[0.2em]">Management</span>
                </div>
              </div>
            )}
          </div>
          {isEmbedded && isSidebarOpen && (
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {isSidebarOpen && <div className="text-[10px] uppercase font-semibold text-slate-500 px-3 mb-2 mt-4">MENU</div>}
          
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                onClick={handleNavItemClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group",
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-white" : "text-slate-500 group-hover:text-blue-400")} />
                {isSidebarOpen && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700/50 flex flex-col gap-2 bg-[#0f172a]/50">
          <button 
            onClick={() => setIsDonateOpen(true)}
            className={cn(
              "w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded font-bold text-[10px] transition-all ring-offset-2 ring-offset-slate-900 group",
              !isSidebarOpen && "px-0"
            )}
          >
            <Heart className="w-4 h-4 group-hover:fill-current" />
            {isSidebarOpen && <span>QRIS</span>}
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md text-xs font-bold transition-all transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className={cn(
          "bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10",
          isEmbedded ? "h-14" : "h-16"
        )}>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-slate-400 hover:text-slate-900"
            >
              <Menu className="w-4 h-4" />
            </Button>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-slate-800 leading-none">
                {navItems.find(i => i.path === location.pathname)?.name || 'Dashboard'}
              </h2>
              <div className="flex gap-1 mt-1">
                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-black rounded border border-blue-100 uppercase tracking-tighter">ROLE: {user?.role}</span>
                <span className="px-1.5 py-0.5 bg-slate-50 text-slate-600 text-[8px] font-black rounded border border-slate-100 uppercase tracking-tighter">WILAYAH: {user?.wilayah}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-900 leading-tight">{user?.namaLengkap}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{user?.role === 'ADMIN' ? 'Administrator' : 'Pengurus Unit'}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-black text-sm ring-2 ring-primary/5">
              {user?.namaLengkap?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <div className="flex-1 p-6 overflow-y-auto bg-[#f8fafc]">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Status Bar */}
        {!isEmbedded && (
          <footer className="h-10 bg-slate-100 border-t border-slate-200 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                System Online: {orgName.toLowerCase().replace(/\s/g, '')}.org
              </span>
              <span className="opacity-40">|</span>
              <span>Server: Google Cloud Platform (Apps Script)</span>
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              SIMO-LSP v2.5.0 • Build {format(new Date(), 'yyyy.MM.dd')}
            </div>
          </footer>
        )}
      </main>

      <DonateModal open={isDonateOpen} onOpenChange={setIsDonateOpen} />
    </div>
  );
}
