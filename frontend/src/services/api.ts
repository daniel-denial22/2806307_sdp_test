import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Repository {
  id: string;
  name: string;
  path: string;
  total_commits?: number;
  total_files?: number;
  total_authors?: number;
}

export interface FileMetric {
  path: string;
  added_lines: number;
  removed_lines: number;
  growth: number;
  churn: number;
  modifications: number;
  modification_frequency: number;
  churn_rate: number;
}

export interface DirectoryMetric {
  path: string;
  added_lines: number;
  removed_lines: number;
  growth: number;
  churn: number;
  modifications: number;
  modification_frequency: number;
  churn_rate: number;
}

export interface AuthorMetric {
  author: string;
  email: string;
  added_lines: number;
  removed_lines: number;
  growth: number;
  modifications: number;
  churn: number;
  ownership: number;
  file_ownership: Record<string, number>;
}

export interface RepositoryMetrics {
  added_lines: number;
  removed_lines: number;
  growth: number;
  churn: number;
  modifications: number;
  modification_frequency: number;
  churn_rate: number;
  commit_count: number;
  total_files: number;
}

export interface CommitSetMetrics {
  commit_count: number;
  added_lines: number;
  removed_lines: number;
  growth: number;
  churn: number;
  files_modified: number;
  modification_frequency: number;
}

export interface CommitInfo {
  hash: string;
  author: string;
  email: string;
  date: number;
  message: string;
}

export interface MetricFilters {
  start_time?: number;
  end_time?: number;
  commits?: string[];
}

const filterParams = (f?: MetricFilters) => ({
  start_time: f?.start_time,
  end_time: f?.end_time,
  commit_hashes: f?.commits?.length ? f.commits.join(',') : undefined,
});

// Repository APIs
export const repoApi = {
  list: () => api.get<{ repositories: Repository[] }>('/repos/'),
  get: (repoId: string) => api.get<Repository>(`/repos/${repoId}`),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/repos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  clone: (url: string) => {
    const params = new URLSearchParams();
    params.append('url', url);
    return api.post('/repos/clone', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  delete: (repoId: string) => api.delete(`/repos/${repoId}`),
  commits: (repoId: string, limit = 1000) =>
    api.get<{ commits: CommitInfo[] }>(`/repos/${repoId}/commits`, {
      params: { limit },
    }),
};

// Metrics APIs
export const metricsApi = {
  getFiles: (repoId: string, filters?: MetricFilters) =>
    api.get<{ metrics: FileMetric[] }>(`/metrics/${repoId}/files`, {
      params: filterParams(filters),
    }),
  getDirectories: (repoId: string, filters?: MetricFilters) =>
    api.get<{ metrics: DirectoryMetric[] }>(`/metrics/${repoId}/directories`, {
      params: filterParams(filters),
    }),
  getRepository: (repoId: string, filters?: MetricFilters) =>
    api.get<{ metrics: RepositoryMetrics }>(`/metrics/${repoId}/repository`, {
      params: filterParams(filters),
    }),
  getAuthors: (repoId: string, filters?: MetricFilters) =>
    api.get<{ metrics: AuthorMetric[] }>(`/metrics/${repoId}/authors`, {
      params: filterParams(filters),
    }),
  getCommitSet: (repoId: string, filters?: MetricFilters) =>
    api.get<{ metrics: CommitSetMetrics }>(`/metrics/${repoId}/commits`, {
      params: filterParams(filters),
    }),
};
