import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { repoApi, Repository } from '../services/api';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const response = await repoApi.list();
      const reposWithData = await Promise.all(
        response.data.repositories.map(async (repo) => {
          try {
            const info = await repoApi.get(repo.id);
            return info.data;
          } catch {
            return repo;
          }
        })
      );
      setRepositories(reposWithData);
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

  if (loading) {
    return <div className="loading">Loading repositories...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Repository Dashboard</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      {repositories.length === 0 ? (
        <div className="empty-state">
          <h2>No repositories yet</h2>
          <p>Upload or clone a repository to get started</p>
        </div>
      ) : (
        <div className="repo-grid">
          {repositories.map((repo) => (
            <div
              key={repo.id}
              className="repo-card"
              onClick={() => handleRepoClick(repo.id)}
            >
              <h3>{repo.name}</h3>
              <div className="repo-stats">
                {repo.total_commits !== undefined && (
                  <span>Commits: {repo.total_commits}</span>
                )}
                {repo.total_files !== undefined && (
                  <span>Files: {repo.total_files}</span>
                )}
                {repo.total_authors !== undefined && (
                  <span>Authors: {repo.total_authors}</span>
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
