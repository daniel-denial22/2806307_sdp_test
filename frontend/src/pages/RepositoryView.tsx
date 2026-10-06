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
  MetricFilters,
  CommitInfo,
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
  const [filters, setFilters] = useState<MetricFilters>({});
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [commitPickerOpen, setCommitPickerOpen] = useState(false);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [draftCommits, setDraftCommits] = useState<string[]>([]);
  const [commitSearch, setCommitSearch] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');
  const [authorOptions, setAuthorOptions] = useState<AuthorMetric[]>([]);

  useEffect(() => {
    if (repoId) {
      loadData({});
    }
  }, [repoId]);

  const loadData = async (f: MetricFilters) => {
    try {
      setLoading(true);
      setError(null);

      const [repoRes, metricsRes, filesRes, dirsRes, authorsRes] = await Promise.all([
        repoApi.get(repoId!),
        metricsApi.getRepository(repoId!, f),
        metricsApi.getFiles(repoId!, f),
        metricsApi.getDirectories(repoId!, f),
        metricsApi.getAuthors(repoId!, f),
      ]);

      setRepo(repoRes.data);
      setRepoMetrics(metricsRes.data.metrics);
      setFileMetrics(filesRes.data.metrics);
      setDirMetrics(dirsRes.data.metrics);
      setAuthorMetrics(authorsRes.data.metrics);
      if (!f.author) {
        setAuthorOptions(authorsRes.data.metrics);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load repository data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toUnix = (value: string) =>
    value ? Math.floor(new Date(value).getTime() / 1000) : undefined;

  const applyFilters = () => {
    const next: MetricFilters = {
      start_time: toUnix(draftFrom),
      end_time: toUnix(draftTo),
      commits: draftCommits.length ? draftCommits : undefined,
      author: draftAuthor || undefined,
    };
    setFilters(next);
    setCommitPickerOpen(false);
    loadData(next);
  };

  const clearFilters = () => {
    setDraftFrom('');
    setDraftTo('');
    setDraftCommits([]);
    setDraftAuthor('');
    setFilters({});
    loadData({});
  };

  const openCommitPicker = async () => {
    if (!commitPickerOpen && commits.length === 0) {
      try {
        const res = await repoApi.commits(repoId!, 1000);
        setCommits(res.data.commits);
      } catch (err) {
        console.error(err);
      }
    }
    setDraftCommits(filters.commits ?? []);
    setCommitPickerOpen(!commitPickerOpen);
  };

  const toggleCommit = (hash: string) => {
    setDraftCommits((prev) =>
      prev.includes(hash) ? prev.filter((h) => h !== hash) : [...prev, hash]
    );
  };

  const visibleCommits = commits.filter(
    (c) =>
      !commitSearch ||
      c.message.toLowerCase().includes(commitSearch.toLowerCase()) ||
      c.hash.startsWith(commitSearch) ||
      c.author.toLowerCase().includes(commitSearch.toLowerCase())
  );

  const filterSummary = [
    filters.author ? `author ${filters.author}` : null,
    filters.start_time ? `from ${new Date(filters.start_time * 1000).toLocaleDateString()}` : null,
    filters.end_time ? `to ${new Date(filters.end_time * 1000).toLocaleDateString()}` : null,
    filters.commits?.length ? `${filters.commits.length} selected commits` : null,
  ]
    .filter(Boolean)
    .join(' · ');

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

      <div className="filter-bar">
        <div className="filter-group">
          <label htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="datetime-local"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="datetime-local"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-author">Author</label>
          <select
            id="filter-author"
            value={draftAuthor}
            onChange={(e) => setDraftAuthor(e.target.value)}
          >
            <option value="">All authors</option>
            {authorOptions.map((a) => (
              <option key={`${a.author} <${a.email}>`} value={`${a.author} <${a.email}>`}>
                {a.author} &lt;{a.email}&gt;
              </option>
            ))}
          </select>
        </div>
        <button className="filter-btn" onClick={openCommitPicker}>
          🔀 Commits{filters.commits?.length ? ` (${filters.commits.length})` : ''}
        </button>
        <button className="filter-btn primary" onClick={applyFilters}>Apply</button>
        <button className="filter-btn" onClick={clearFilters}>Clear</button>
        {filterSummary && <span className="filter-chip">⚙ {filterSummary}</span>}
      </div>

      {commitPickerOpen && (
        <div className="commit-picker">
          <input
            className="commit-search"
            placeholder="Search by message, author or hash..."
            value={commitSearch}
            onChange={(e) => setCommitSearch(e.target.value)}
          />
          <div className="commit-list">
            {visibleCommits.map((c) => (
              <label key={c.hash} className="commit-item">
                <input
                  type="checkbox"
                  checked={draftCommits.includes(c.hash)}
                  onChange={() => toggleCommit(c.hash)}
                />
                <code>{c.hash.slice(0, 8)}</code>
                <span className="commit-date">
                  {new Date(c.date * 1000).toLocaleDateString()}
                </span>
                <span className="commit-author">{c.author}</span>
                <span className="commit-msg">{c.message}</span>
              </label>
            ))}
          </div>
          <div className="commit-picker-actions">
            <span>{draftCommits.length} selected</span>
            <button className="filter-btn primary" onClick={applyFilters}>Apply selection</button>
          </div>
        </div>
      )}

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
            <div className="metric-card">
              <div className="metric-value">{repoMetrics.commit_count.toLocaleString()}</div>
              <div className="metric-label">Commits in Set</div>
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
