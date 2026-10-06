import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RepositoryView from './pages/RepositoryView';
import UploadRepo from './pages/UploadRepo';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <Link to="/">Repo Analysis Tool</Link>
          </div>
          <div className="nav-links">
            <Link to="/">Dashboard</Link>
            <Link to="/upload">Upload Repository</Link>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadRepo />} />
            <Route path="/repo/:repoId" element={<RepositoryView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
