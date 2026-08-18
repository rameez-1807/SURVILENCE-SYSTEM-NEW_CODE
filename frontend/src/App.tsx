import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Live from './pages/Live';
import Events from './pages/Events';
import Attendance from './pages/Attendance';
import Objects from './pages/Objects';
import Vehicles from './pages/Vehicles';
import Evidence from './pages/Evidence';
import Analytics from './pages/Analytics';
import Health from './pages/Health';
import Settings from './pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="cameras" element={<Cameras />} />
          <Route path="live" element={<Live />} />
          <Route path="events" element={<Events />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="objects" element={<Objects />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="evidence" element={<Evidence />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="health" element={<Health />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
