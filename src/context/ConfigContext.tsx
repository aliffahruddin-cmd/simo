import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from './AuthContext';

interface Permission {
  role: string;
  menu_key: string;
  is_allowed: number;
}

interface ConfigContextType {
  orgName: string;
  logoUrl: string;
  exportLogoUrl: string;
  websiteUrl: string;
  qrisUrl: string;
  merchantName: string;
  permissions: Permission[];
  refreshConfig: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [config, setConfig] = useState({
    orgName: 'SIMAK',
    logoUrl: '',
    exportLogoUrl: '',
    websiteUrl: '',
    qrisUrl: '',
    merchantName: '',
  });

  const fetchConfig = async () => {
    try {
      const data = await apiRequest('/config');
      setConfig({
        orgName: data.orgName || 'SIMAK',
        logoUrl: data.logoUrl || '',
        exportLogoUrl: data.exportLogoUrl || '',
        websiteUrl: data.websiteUrl || '',
        qrisUrl: data.qrisUrl || '',
        merchantName: data.merchantName || 'LASKAR SANGIDU PUTIH',
      });
    } catch (err) {
      console.error('Failed to fetch public config', err);
    }

    if (user) {
      try {
        const perms = await apiRequest('/permissions');
        setPermissions(perms);
      } catch (err) {
        console.error('Failed to fetch permissions (Unauthorized)', err);
        setPermissions([]);
      }
    } else {
      setPermissions([]);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [user]);

  return (
    <ConfigContext.Provider value={{ ...config, permissions, refreshConfig: fetchConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
