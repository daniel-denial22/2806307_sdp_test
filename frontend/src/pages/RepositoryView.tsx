import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  repoApi,
  metricsApi,
  Repository,
  RepositoryMetrics,
  FileMetric,
  DirectoryMetric,
  AuthorMetric,
} from '../services/api';

const RepositoryView: React.FC = () => {
  const { repoId } = useParams<{ repoId: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [repoMetrics, setRepoMetrics] = useState<RepositoryMetrics | null>(null);
  const [fileMetrics, setFileMetrics] = useState<FileMetric[]>([]);
  const [dirMetrics, setDirMetrics] = useState<DirectoryMetric[]>([]);
  const [authorMetrics, setAuthorMetrics] = useState<AuthorMetric[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'directories' | 'authors'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (repoId) {
      loadData();
    }
  }, [repoId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [repoRes, metricsRes, filesRes, dirsRes, authorsRes] = await Promise.all([
        repoApi.get(repoId!),
        metricsApi.getRepository(repoId!),
        metricsApi.getFiles(repoId!),
        metricsApi.getDirectories(repoId!),
        metricsApi.getAuthors(repoId!),
      ]);

      setRepo(repoRes.data);
      setRepoMetrics(metricsRes.data.metrics);
      setFileMetrics(filesRes.data.metrics);
      setDirMetrics(dirsRes.data.metrics);
      setAuthorMetrics(authorsRes.data.metrics);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load repository data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading"> Loading repository data...</div>;
  }

  if (error || !repo) {
    return <div className="error-message">❌ {error || 'Repository not found'}</div>;
  }

  return (
    <div className="repository-view">
      <div className="repo-header">
        <h1>📊 {repo.name}</h1>
        <div className="repo-info">
          {repo.total_commits !== undefined && <span>📝 {repo.total_commits.toLocaleString()} commits</span>}
          {repo.total_files !== undefined && <span>📄 {repo.total_files.toLocaleString()} files</span>}
          {repo.total_authors !== undefined && <span> {repo.total_authors.toLocaleString()} authors</span>}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
           Overview
        </button>
        <button
          className={`tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          📄 Files
        </button>
        <button
          className={`tab ${activeTab === 'directories' ? 'active' : ''}`}
          onClick={() => setActiveTab('directories')}
        >
          📁 Directories
        </button>
        <button
          className={`tab ${activeTab === 'authors' ? 'active' : ''}`}
          onClick={() => setActiveTab('authors')}
        >
          👥 Authors
        </button>
      </div>

      {activeTab === 'overview' && repoMetrics && (
        <div className="metrics-section">
          <h2>Repository Overview</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-value">{repoMetrics.added_lines.toLocaleString()}</div>
              <div className="metric-label">Lines Added</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{repoMetrics.removed_lines.toLocaleString()}</div>
              <div className="metric-label">Lines Removed</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{repoMetrics.growth.toLocaleString()}</div>
              <div className="metric-label">Net Growth</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{repoMetrics.churn.toLocaleString()}</div>
              <div className="metric-label">Total Churn</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{repoMetrics.total_files.toLocaleString()}</div>
              <div className="metric-label">Files Modified</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{repoMetrics.churn_rate.toFixed(2)}</div>
              <div className="metric-label">Churn Rate</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div className="metrics-section">
          <h2>📄 File Metrics</h2>
          <table className="metrics-table">
            <thead>
              <tr>
                <th>File Path</th>
                <th>Added</th>
                <th>Removed</th>
                <th>Growth</th>
                <th>Churn</th>
                <th>Modifications</th>
              </tr>
            </thead>
            <tbody>
              {fileMetrics.map((file) => (
                <tr key={file.path}>
                  <td>{file.path}</td>
                  <td>{file.added_lines.toLocaleString()}</td>
                  <td>{file.removed_lines.toLocaleString()}</td>
                  <td>{file.growth.toLocaleString()}</td>
                  <td>{file.churn.toLocaleString()}</td>
                  <td>{file.modifications.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'directories' && (
        <div className="metrics-section">
          <h2>📁 Directory Metrics</h2>
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Directory</th>
                <th>Added</th>
                <th>Removed</th>
                <th>Growth</th>
                <th>Churn</th>
                <th>Modifications</th>
              </tr>
            </thead>
            <tbody>
              {dirMetrics.map((dir) => (
                <tr key={dir.path}>
                  <td>{dir.path || '/'}</td>
                  <td>{dir.added_lines.toLocaleString()}</td>
                  <td>{dir.removed_lines.toLocaleString()}</td>
                  <td>{dir.growth.toLocaleString()}</td>
                  <td>{dir.churn.toLocaleString()}</td>
                  <td>{dir.modifications.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'authors' && (
        <div className="metrics-section">
          <h2> Author Metrics</h2>
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Author</th>
                <th>Email</th>
                <th>Added</th>
                <th>Removed</th>
                <th>Modifications</th>
                <th>Churn</th>
                <th>Ownership</th>
              </tr>
            </thead>
            <tbody>
              {authorMetrics.map((author) => (
                <tr key={author.email}>
                  <td>{author.author}</td>
                  <td>{author.email}</td>
                  <td>{author.added_lines.toLocaleString()}</td>
                  <td>{author.removed_lines.toLocaleString()}</td>
                  <td>{author.modifications.toLocaleString()}</td>
                  <td>{author.churn.toLocaleString()}</td>
                  <td>{(author.ownership * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RepositoryView;
