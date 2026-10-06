import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { repoApi } from '../services/api';

const UploadRepo: React.FC = () => {
  const navigate = useNavigate();
  const [cloneUrl, setCloneUrl] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneUrl) return;

    try {
      setLoading(true);
      setError(null);
      const response = await repoApi.clone(cloneUrl);
      setSuccess('Repository cloned successfully!');
      setTimeout(() => navigate('/'), 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clone repository');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipFile) return;

    try {
      setLoading(true);
      setError(null);
      const response = await repoApi.upload(zipFile);
      setSuccess('Repository uploaded successfully!');
      setTimeout(() => navigate('/'), 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-page">
      <h1>Add Repository</h1>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="upload-section">
        <h2>Clone from URL</h2>
        <form onSubmit={handleClone}>
          <div className="form-group">
            <label>Repository URL</label>
            <input
              type="url"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Cloning...' : 'Clone Repository'}
          </button>
        </form>
      </div>

      <div className="upload-section">
        <h2>Upload ZIP File</h2>
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label>ZIP File (must contain .git directory)</label>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => setZipFile(e.target.files?.[0] || null)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Uploading...' : 'Upload Repository'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadRepo;
