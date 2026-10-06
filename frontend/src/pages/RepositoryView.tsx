import React, { useState, useEffect, useRef } from 'react';
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
  MetricsBundle,
} from '../services/api';
import { TopChurnBar, AddedRemovedBar, OwnershipPie } from '../components/MetricCharts';

const RepositoryView: React.FC = () => {
  const { repoId } = useParams<{ repoId: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [repoMetrics, setRepoMetrics] = useState<RepositoryMetrics | null>(null);
  const [fileMetrics, setFileMetrics] = useState<FileMetric[]>([]);
  const [dirMetrics, setDirMetrics] = useState<DirectoryMetric[]>([]);
  const [authorMetrics, setAuthorMetrics] = useState<AuthorMetric[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'directories' | 'authors'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [draftPath, setDraftPath] = useState('');
  const [pathOptions, setPathOptions] = useState<string[]>([]);
  const [merges, setMerges] = useState<Record<string, string>>({});
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  // Tracks the most recent metrics request so out-of-order responses from
  // rapid, real-time filter changes can never overwrite newer data.
  const requestSeq = useRef(0);
  // Debounce timer for real-time filter changes.
  const applyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (repoId) {
      loadData({}, true);
      loadMerges();
    }
  }, [repoId]);

  const loadMerges = async () => {
    try {
      const res = await repoApi.getMerges(repoId!);
      setMerges(res.data.merges);
    } catch (err) {
      console.error(err);
    }
  };

  const applyMerge = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    try {
      const res = await repoApi.addMerge(repoId!, mergeSource, mergeTarget);
      setMerges(res.data.merges);
      setMergeSource('');
      setMergeTarget('');
      loadData(filters);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to merge authors');
    }
  };

  const undoMerge = async (source: string) => {
    try {
      const res = await repoApi.removeMerge(repoId!, source);
      setMerges(res.data.merges);
      loadData(filters);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove merge');
    }
  };

  const loadData = async (f: MetricFilters, initial = false) => {
    const seq = ++requestSeq.current;
    try {
      // Only the very first load blocks the whole page. Filter changes refresh
      // in the background so the controls stay visible and interactive.
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const [repoRes, bundleRes] = await Promise.all([
        repoApi.get(repoId!),
        metricsApi.getBundle(repoId!, f),
      ]);

      // A newer request superseded this one; discard the stale response.
      if (seq !== requestSeq.current) return;

      const bundle: MetricsBundle = bundleRes.data;
      setRepo(repoRes.data);
      setRepoMetrics(bundle.repository);
      setFileMetrics(bundle.files);
      setDirMetrics(bundle.directories);
      setAuthorMetrics(bundle.authors);
      if (!f.author) {
        setAuthorOptions(bundle.authors);
      }
      if (!f.path) {
        setPathOptions(
          [
            ...bundle.files.map((m) => m.path),
            ...bundle.directories.map((m) => m.path),
          ].sort()
        );
      }
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      setError(err.response?.data?.detail || 'Failed to load repository data');
      console.error(err);
    } finally {
      // Only the latest request may clear the busy flags.
      if (seq === requestSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const dayStart = (value: string) => {
    if (!value) return undefined;
    const [y, m, d] = value.split('-').map(Number);
    return Math.floor(new Date(y, m - 1, d, 0, 0, 0).getTime() / 1000);
  };

  const dayAfter = (value: string) => {
    if (!value) return undefined;
    const [y, m, d] = value.split('-').map(Number);
    // "To" day is inclusive: the set ends at the start of the next day
    return Math.floor(new Date(y, m - 1, d + 1, 0, 0, 0).getTime() / 1000);
  };

  const applyFilters = () => {
    const next: MetricFilters = {
      start_time: dayStart(draftFrom),
      end_time: dayAfter(draftTo),
      commits: draftCommits.length ? draftCommits : undefined,
      author: draftAuthor || undefined,
      path: draftPath.trim() || undefined,
    };
    setFilters(next);
    setCommitPickerOpen(false);
    loadData(next);
  };

  // Filters apply as soon as they change; Apply stays as an explicit action
  const applyNow = (next: MetricFilters) => {
    setFilters(next);
    loadData(next);
  };

  // Debounced variant so typing in date/path fields doesn't fire a full
  // re-aggregation on every keystroke.
  const scheduleApply = (next: MetricFilters) => {
    window.clearTimeout(applyTimer.current);
    applyTimer.current = window.setTimeout(() => applyNow(next), 350);
  };

  const filtersFromDrafts = (over: {
    from?: string;
    to?: string;
    author?: string;
    commits?: string[];
    path?: string;
  } = {}): MetricFilters => {
    const from = over.from !== undefined ? over.from : draftFrom;
    const to = over.to !== undefined ? over.to : draftTo;
    const author = over.author !== undefined ? over.author : draftAuthor;
    const commits = over.commits !== undefined ? over.commits : draftCommits;
    const path = over.path !== undefined ? over.path : draftPath;
    return {
      start_time: dayStart(from),
      end_time: dayAfter(to),
      commits: commits.length ? commits : undefined,
      author: author || undefined,
      path: path.trim() || undefined,
    };
  };

  const changeFrom = (v: string) => {
    setDraftFrom(v);
    scheduleApply(filtersFromDrafts({ from: v }));
  };

  const changeTo = (v: string) => {
    setDraftTo(v);
    scheduleApply(filtersFromDrafts({ to: v }));
  };

  const changeAuthor = (v: string) => {
    setDraftAuthor(v);
    applyNow(filtersFromDrafts({ author: v }));
  };

  const applyPath = (v: string) => {
    const next = v.trim() || undefined;
    if (filters.path === next) return;
    applyNow(filtersFromDrafts({ path: v }));
  };

  const changePath = (v: string) => {
    setDraftPath(v);
    // Picking a suggestion from the datalist applies immediately;
    // typed paths apply on Enter or blur
    if (pathOptions.includes(v)) applyPath(v);
  };

  const clearFilters = () => {
    setDraftFrom('');
    setDraftTo('');
    setDraftCommits([]);
    setDraftAuthor('');
    setDraftPath('');
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
    const nextCommits = draftCommits.includes(hash)
      ? draftCommits.filter((h) => h !== hash)
      : [...draftCommits, hash];
    setDraftCommits(nextCommits);
    scheduleApply(filtersFromDrafts({ commits: nextCommits }));
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
    filters.path ? `path ${filters.path}` : null,
    filters.start_time ? `from ${new Date(filters.start_time * 1000).toLocaleDateString()}` : null,
    filters.end_time ? `to ${new Date(filters.end_time * 1000).toLocaleDateString()}` : null,
    filters.commits?.length ? `${filters.commits.length} selected commits` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Full-page states only apply before the repository has loaded once;
  // afterwards, filter refreshes happen in place.
  if (loading && !repo) {
    return <div className="loading"> Loading repository data...</div>;
  }

  if (!repo) {
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
            type="date"
            value={draftFrom}
            onChange={(e) => changeFrom(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="date"
            value={draftTo}
            onChange={(e) => changeTo(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-author">Author</label>
          <select
            id="filter-author"
            value={draftAuthor}
            onChange={(e) => changeAuthor(e.target.value)}
          >
            <option value="">All authors</option>
            {authorOptions.map((a) => (
              <option key={`${a.author} <${a.email}>`} value={`${a.author} <${a.email}>`}>
                {a.author} &lt;{a.email}&gt;
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filter-path">Path</label>
          <div className="path-input-wrap">
            <input
              id="filter-path"
              list="path-options"
              placeholder="file or directory"
              value={draftPath}
              onChange={(e) => changePath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyPath(draftPath)}
              onBlur={() => applyPath(draftPath)}
            />
            <span className="path-chevron" aria-hidden="true">▾</span>
          </div>
          <datalist id="path-options">
            {pathOptions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <button className="filter-btn" onClick={openCommitPicker}>
          🔀 Commits{filters.commits?.length ? ` (${filters.commits.length})` : ''}
        </button>
        <button className="filter-btn primary" onClick={applyFilters}>Apply</button>
        <button className="filter-btn" onClick={clearFilters}>Clear</button>
        {refreshing ? (
          <span className="filter-chip refreshing">⟳ Updating…</span>
        ) : error ? (
          <span className="filter-chip error-chip">⚠ {error}</span>
        ) : (
          filterSummary && <span className="filter-chip">⚙ {filterSummary}</span>
        )}
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
          <div className="charts-row">
            <OwnershipPie authors={authorMetrics} />
            <TopChurnBar
              title={dirMetrics.length ? 'Top directories by churn' : 'Filtered file churn'}
              items={dirMetrics.length ? dirMetrics : fileMetrics}
            />
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div className="metrics-section">
          <div className="charts-row">
            <TopChurnBar title="Top files by churn" items={fileMetrics} />
            <AddedRemovedBar items={fileMetrics} />
          </div>
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
          <div className="charts-row">
            <AddedRemovedBar items={dirMetrics} />
          </div>
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
          <div className="merge-panel">
            <h3>Merge duplicate author identities</h3>
            <div className="merge-controls">
              <select value={mergeSource} onChange={(e) => setMergeSource(e.target.value)}>
                <option value="">Select author to merge…</option>
                {authorMetrics.map((a) => (
                  <option key={`s-${a.email}`} value={`${a.author} <${a.email}>`}>
                    {a.author} &lt;{a.email}&gt;
                  </option>
                ))}
              </select>
              <span>into</span>
              <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
                <option value="">Select canonical author…</option>
                {authorMetrics.map((a) => (
                  <option key={`t-${a.email}`} value={`${a.author} <${a.email}>`}>
                    {a.author} &lt;{a.email}&gt;
                  </option>
                ))}
              </select>
              <button className="filter-btn primary" onClick={applyMerge}>Merge</button>
            </div>
            {Object.keys(merges).length > 0 && (
              <ul className="merge-list">
                {Object.entries(merges).map(([src, dst]) => (
                  <li key={src}>
                    <code>{src}</code> → <code>{dst}</code>{' '}
                    <button className="filter-btn" onClick={() => undoMerge(src)}>Undo</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
