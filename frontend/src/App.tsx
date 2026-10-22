import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Documents from './pages/Documents';
import DocumentViewer from './pages/DocumentViewer';
import Chat from './pages/Chat';
import Search from './pages/Search';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <a href="/" style={{position:"fixed",right:12,bottom:12,zIndex:1000,background:"#fff",color:"#111",padding:"8px 12px",borderRadius:8,boxShadow:"0 0 0 1px #ddd",fontSize:13}}>Open new DocuLaw ↗</a>
        <Routes>
          {/* Public routes without layout */}
          <Route path="/" element={<Landing />} />
          <Route path="/classic/*" element={<Landing />} />
          <Route path="/onboarding" element={<Onboarding />} />
          
          {/* Protected routes with layout */}
          <Route path="/home" element={<Layout><Home /></Layout>} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/upload" element={<Layout><Upload /></Layout>} />
          <Route path="/documents" element={<Layout><Documents /></Layout>} />
          <Route path="/documents/:id" element={<Layout><DocumentViewer /></Layout>} />
          <Route path="/chat" element={<Layout><Chat /></Layout>} />
          <Route path="/chat/:sessionId" element={<Layout><Chat /></Layout>} />
          <Route path="/search" element={<Layout><Search /></Layout>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 