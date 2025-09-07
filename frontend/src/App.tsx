import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Upload from './pages/Upload';
import DocumentViewer from './pages/DocumentViewer';
import DocumentWorkspace from './pages/DocumentWorkspace';
import Chat from './pages/Chat';
import Search from './pages/Search';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import GlassButtonDemo from './pages/GlassButtonDemo';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            
            {/* Protected routes with layout */}
            <Route path="/home" element={
              <ProtectedRoute>
                <Layout><Home /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/upload" element={
              <ProtectedRoute>
                <Layout><Upload /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/documents" element={
              <ProtectedRoute>
                <Layout><Documents /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/documents/:id" element={
              <ProtectedRoute>
                <Layout><DocumentViewer /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:id" element={
              <ProtectedRoute>
                <Layout><DocumentWorkspace /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute>
                <Layout><Chat /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/chat/:sessionId" element={
              <ProtectedRoute>
                <Layout><Chat /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/search" element={
              <ProtectedRoute>
                <Layout><Search /></Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App; 