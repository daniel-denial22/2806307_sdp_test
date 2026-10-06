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
}

export interface DirectoryMetric {
  path: string;
  added_lines: number;
  removed_lines: number;
  growth: number;
  churn: number;
}

export interface AuthorMetric {
  author: string;
  email: string;
  modifications: number;
  churn: number;
  ownership: Record<string, number>;
}

export interface RepositoryMetrics {
  added_lines: number;
  removed_lines: number;
  growth: number;
  churn: number;
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
    const formData = new FormData();
    formData.append('url', url);
    return api.post('/repos/clone', formData);
  },
  delete: (repoId: string) => api.delete(`/repos/${repoId}`),
};

// Metrics APIs
export const metricsApi = {
  getFiles: (repoId: string, commitHash?: string) =>
    api.get<{ metrics: FileMetric[] }>(`/metrics/${repoId}/files`, {
      params: { commit_hash: commitHash },
    }),
  getDirectories: (repoId: string, commitHash?: string) =>
    api.get<{ metrics: DirectoryMetric[] }>(`/metrics/${repoId}/directories`, {
      params: { commit_hash: commitHash },
    }),
  getRepository: (repoId: string, commitHash?: string) =>
    api.get<{ metrics: RepositoryMetrics }>(`/metrics/${repoId}/repository`, {
      params: { commit_hash: commitHash },
    }),
  getAuthors: (repoId: string, commitHash?: string) =>
    api.get<{ metrics: AuthorMetric[] }>(`/metrics/${repoId}/authors`, {
      params: { commit_hash: commitHash },
    }),
  getCommitSet: (
    repoId: string,
    startTime?: number,
    endTime?: number,
    commitHashes?: string[]
  ) =>
    api.get<{ metrics: CommitSetMetrics }>(`/metrics/${repoId}/commits`, {
      params: {
        start_time: startTime,
        end_time: endTime,
        commit_hashes: commitHashes?.join(','),
      },
    }),
};
