import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { repoApi, Repository } from '../services/api';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deletingRepo, setDeletingRepo] = useState<string | null>(null);

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const response = await repoApi.list();
      setRepositories(response.data.repositories);
      setError(null);
    } catch (err) {
      setError('Failed to load repositories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRepoClick = (repoId: string) => {
    navigate(`/repo/${repoId}`);
  };

  const handleDelete = async (repo: Repository) => {
    if (!window.confirm(`Remove ${repo.name} from RAT? This deletes its local clone.`)) return;
    try {
      setDeletingRepo(repo.id);
      setError(null);
      await repoApi.delete(repo.id);
      setRepositories((current) => current.filter((item) => item.id !== repo.id));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove repository');
    } finally {
      setDeletingRepo(null);
    }
  };

  const visibleRepositories = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading repositories...</div>;
  }

  return (
    <div className="dashboard">
      <h1>📊 Repository Dashboard</h1>

      {repositories.length > 0 && (
        <div className="dashboard-tools">
          <label htmlFor="repo-search">Find a repository</label>
          <input
            id="repo-search"
            type="search"
            placeholder="Search by repository name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span>{visibleRepositories.length} of {repositories.length}</span>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      {repositories.length === 0 ? (
        <div className="empty-state">
          <h2>No repositories yet</h2>
          <p>Upload or clone a repository to get started with analysis</p>
        </div>
      ) : visibleRepositories.length === 0 ? (
        <div className="empty-state">
          <h2>No matching repositories</h2>
          <p>Try a different repository name.</p>
        </div>
      ) : (
        <div className="repo-grid">
          {visibleRepositories.map((repo) => (
            <div
              key={repo.id}
              className="repo-card"
              onClick={() => handleRepoClick(repo.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleRepoClick(repo.id)}
              role="button"
              tabIndex={0}
            >
              <div className="repo-card-heading">
                <h3>📁 {repo.name}</h3>
                <button
                  className="repo-delete-btn"
                  disabled={deletingRepo === repo.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(repo);
                  }}
                  aria-label={`Remove ${repo.name}`}
                >
                  {deletingRepo === repo.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
              <div className="repo-stats">
                {repo.total_commits !== undefined && (
                  <span>📝 Commits: {repo.total_commits.toLocaleString()}</span>
                )}
                {repo.total_files !== undefined && (
                  <span>📄 Files: {repo.total_files.toLocaleString()}</span>
                )}
                {repo.total_authors !== undefined && (
                  <span>👥 Authors: {repo.total_authors.toLocaleString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
