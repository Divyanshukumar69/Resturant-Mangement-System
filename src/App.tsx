/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/LoginPage';
import CustomerTable from './pages/CustomerTable';
import KitchenDashboard from './pages/KitchenDashboard';
import BillingDashboard from './pages/BillingDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LandingPage from './pages/LandingPage';
import WaiterDashboard from './pages/WaiterDashboard';
import DeveloperFooter from './components/DeveloperFooter';

const ProtectedRoute = ({ children, allowedRoles }: { children: ReactNode, allowedRoles: string[] }) => {
  const { token, role } = useAuth();
  if (!token) return <Navigate to="/" />;
  if (!allowedRoles.includes(role || '')) return <Navigate to="/" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="flex flex-col min-h-screen">
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/table/:restaurantId/:tableId" element={<CustomerTable />} />
              <Route path="/landing/:restaurantId" element={<LandingPage />} />

              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />

              <Route path="/kitchen" element={
                <ProtectedRoute allowedRoles={['kitchen', 'admin']}>
                  <KitchenDashboard />
                </ProtectedRoute>
              } />

              <Route path="/billing" element={
                <ProtectedRoute allowedRoles={['billing', 'admin']}>
                  <BillingDashboard />
                </ProtectedRoute>
              } />

              <Route path="/waiter" element={
                <ProtectedRoute allowedRoles={['billing', 'admin', 'kitchen']}>
                  <WaiterDashboard />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
          <DeveloperFooter />
        </div>
      </SocketProvider>
    </AuthProvider>
  );
}

