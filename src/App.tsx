/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfigProvider } from './context/ConfigContext';
import { Layout } from './components/Layout';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import MembersPage from './pages/Members';
import FinancePage from './pages/Finance';
import StructurePage from './pages/Structure';
import ConsolePage from './pages/Console';
import ReportsPage from './pages/Reports';
import PermissionsPage from './pages/Permissions';
import MaintenancePage from './pages/Maintenance';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen w-screen flex items-center justify-center font-bold text-slate-400">Memuat SIMAK...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ConfigProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/" 
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/users" 
              element={
                <PrivateRoute>
                  <UsersPage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/members" 
              element={
                <PrivateRoute>
                  <MembersPage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/structure" 
              element={
                <PrivateRoute>
                  <StructurePage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/finance" 
              element={
                <PrivateRoute>
                  <FinancePage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <PrivateRoute>
                  <ReportsPage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/console" 
              element={
                <PrivateRoute>
                  <ConsolePage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/permissions" 
              element={
                <PrivateRoute>
                  <PermissionsPage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/maintenance" 
              element={
                <PrivateRoute>
                  <MaintenancePage />
                </PrivateRoute>
              } 
            />
          </Routes>
        </ConfigProvider>
      </AuthProvider>
    </Router>
  );
}

