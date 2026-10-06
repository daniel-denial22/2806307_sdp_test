import git
from typing import List, Dict, Optional, Set
from collections import defaultdict
from app.models.schemas import FileMetrics, DirectoryMetrics, RepositoryMetrics, AuthorMetrics
from app.services.git_service import GitService
import os

class MetricsService:
    def __init__(self):
        self.git_service = GitService()

    def _get_commit_diff_stats(self, repo: git.Repo, commit: git.Commit) -> Dict[str, Dict[int, int]]:
        """Get added/removed lines for each file in a commit"""
        stats = {}
        
        if not commit.parents:
            # Initial commit
            diff = commit.diff(git.NULL_TREE)
        else:
            diff = commit.parents[0].diff(commit)
        
        for d in diff:
            if d.a_blob and d.a_blob.path.endswith(('.png', '.jpg', '.gif', '.ico', '.pdf', '.exe', '.bin')):
                continue  # Skip binary files
            
            path = d.b_blob.path if d.b_blob else d.a_blob.path
            
            if path not in stats:
                stats[path] = {'added': 0, 'removed': 0}
            
            # Count line changes
            diff_text = d.diff.decode('utf-8', errors='ignore')
            for line in diff_text.split('\n'):
                if line.startswith('+') and not line.startswith('+++'):
                    stats[path]['added'] += 1
                elif line.startswith('-') and not line.startswith('---'):
                    stats[path]['removed'] += 1
        
        return stats

    def _apply_mailmap(self, repo: git.Repo, author: str, email: str) -> tuple:
        """Apply mailmap to merge authors"""
        try:
            mailmap_path = os.path.join(repo.working_dir, '.mailmap')
            if os.path.exists(mailmap_path):
                with open(mailmap_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith('#'):
                            continue
                        # Format: Proper Name <proper@email> Commit Name <commit@email>
                        parts = line.split('>')
                        if len(parts) >= 2:
                            proper = parts[0].strip() + '>'
                            commit = parts[1].strip()
                            if email in commit or author in commit:
                                # Extract proper name and email
                                proper_parts = proper.split('<')
                                if len(proper_parts) == 2:
                                    return proper_parts[0].strip(), proper_parts[1].replace('>', '').strip()
        except:
            pass
        return author, email

    def get_file_metrics(self, repo_id: str, commit_hash: Optional[str] = None) -> List[Dict]:
        """Get metrics for all files"""
        repo = self.git_service.get_repo(repo_id)
        
        if commit_hash:
            commit = repo.commit(commit_hash)
            commits = [commit]
        else:
            commits = list(repo.iter_commits('HEAD'))
        
        file_metrics = defaultdict(lambda: {'added': 0, 'removed': 0})
        
        for commit in commits:
            stats = self._get_commit_diff_stats(repo, commit)
            for path, changes in stats.items():
                file_metrics[path]['added'] += changes['added']
                file_metrics[path]['removed'] += changes['removed']
        
        result = []
        for path, metrics in file_metrics.items():
            added = metrics['added']
            removed = metrics['removed']
            result.append({
                'path': path,
                'added_lines': added,
                'removed_lines': removed,
                'growth': added - removed,
                'churn': added + removed,
            })
        
        return result

    def get_directory_metrics(self, repo_id: str, commit_hash: Optional[str] = None) -> List[Dict]:
        """Get metrics for all directories"""
        file_metrics = self.get_file_metrics(repo_id, commit_hash)
        
        dir_metrics = defaultdict(lambda: {'added': 0, 'removed': 0})
        
        for file_metric in file_metrics:
            path = file_metric['path']
            dir_path = os.path.dirname(path)
            
            # Aggregate to all parent directories
            while dir_path:
                dir_metrics[dir_path]['added'] += file_metric['added_lines']
                dir_metrics[dir_path]['removed'] += file_metric['removed_lines']
                dir_path = os.path.dirname(dir_path)
            
            # Root directory
            dir_metrics['']['added'] += file_metric['added_lines']
            dir_metrics['']['removed'] += file_metric['removed_lines']
        
        result = []
        for path, metrics in dir_metrics.items():
            added = metrics['added']
            removed = metrics['removed']
            result.append({
                'path': path if path else '/',
                'added_lines': added,
                'removed_lines': removed,
                'growth': added - removed,
                'churn': added + removed,
            })
        
        return result

    def get_repository_metrics(self, repo_id: str, commit_hash: Optional[str] = None) -> Dict:
        """Get metrics for the entire repository"""
        file_metrics = self.get_file_metrics(repo_id, commit_hash)
        
        total_added = sum(m['added_lines'] for m in file_metrics)
        total_removed = sum(m['removed_lines'] for m in file_metrics)
        
        return {
            'added_lines': total_added,
            'removed_lines': total_removed,
            'growth': total_added - total_removed,
            'churn': total_added + total_removed,
            'total_files': len(file_metrics),
        }

    def get_author_metrics(self, repo_id: str, commit_hash: Optional[str] = None) -> List[Dict]:
        """Get metrics for all authors"""
        repo = self.git_service.get_repo(repo_id)
        
        if commit_hash:
            commits = [repo.commit(commit_hash)]
        else:
            commits = list(repo.iter_commits('HEAD'))
        
        author_metrics = defaultdict(lambda: {'modifications': 0, 'churn': 0, 'files': defaultdict(int)})
        
        for commit in commits:
            author, email = self._apply_mailmap(repo, commit.author.name, commit.author.email)
            author_key = f"{author} <{email}>"
            
            stats = self._get_commit_diff_stats(repo, commit)
            
            if stats:
                author_metrics[author_key]['modifications'] += 1
            
            for path, changes in stats.items():
                churn = changes['added'] + changes['removed']
                author_metrics[author_key]['churn'] += churn
                author_metrics[author_key]['files'][path] += churn
        
        result = []
        for author_key, metrics in author_metrics.items():
            author, email = author_key.split(' <')
            email = email.rstrip('>')
            
            # Calculate ownership per file
            ownership = {}
            for file_path, file_churn in metrics['files'].items():
                ownership[file_path] = file_churn / metrics['churn'] if metrics['churn'] > 0 else 0
            
            result.append({
                'author': author,
                'email': email,
                'modifications': metrics['modifications'],
                'churn': metrics['churn'],
                'ownership': ownership,
            })
        
        return result

    def get_commit_set_metrics(
        self,
        repo_id: str,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        commit_hashes: Optional[List[str]] = None
    ) -> Dict:
        """Get metrics for a specific commit set"""
        repo = self.git_service.get_repo(repo_id)
        
        all_commits = list(repo.iter_commits('HEAD'))
        
        # Filter commits
        if commit_hashes:
            commits = [c for c in all_commits if c.hexsha in commit_hashes]
        elif start_time or end_time:
            commits = []
            for c in all_commits:
                commit_time = c.committed_date
                if start_time and commit_time < start_time:
                    continue
                if end_time and commit_time >= end_time:
                    continue
                commits.append(c)
        else:
            commits = all_commits
        
        # Calculate metrics
        file_metrics = defaultdict(lambda: {'added': 0, 'removed': 0, 'modifications': 0})
        
        for commit in commits:
            stats = self._get_commit_diff_stats(repo, commit)
            for path, changes in stats.items():
                file_metrics[path]['added'] += changes['added']
                file_metrics[path]['removed'] += changes['removed']
                if changes['added'] + changes['removed'] > 0:
                    file_metrics[path]['modifications'] += 1
        
        total_added = sum(m['added'] for m in file_metrics.values())
        total_removed = sum(m['removed'] for m in file_metrics.values())
        
        return {
            'commit_count': len(commits),
            'added_lines': total_added,
            'removed_lines': total_removed,
            'growth': total_added - total_removed,
            'churn': total_added + total_removed,
            'files_modified': len(file_metrics),
            'modification_frequency': len(file_metrics) / len(commits) if commits else 0,
        }
