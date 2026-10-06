import git
import os
from typing import List, Dict, Optional
from collections import defaultdict
from datetime import datetime, timezone
from app.services.git_service import GitService
from app.services.cache_service import MetricsCache

# Bump this suffix whenever the aggregation semantics change so stale
# cache entries from older versions are ignored.
CACHE_V = "v2"


class MetricsService:
    """Computes repository metrics.

    Semantics (aligned with the course reference output):
    - The default commit set ("all") contains every NON-MERGE commit
      reachable from HEAD (root commits included).
    - growth = added - removed, churn = added + removed.
    - modifications = number of commits in the set that changed the object.
    - modification_frequency = modifications / commit_count.
    - churn_rate = churn / commit_count.
    - ownership = an author's share of the object's total churn.
    - Directory metrics aggregate the whole subtree; the repository
      metric is the root directory ("/") case.
    - Renamed files are attributed to their new path.
    """

    def __init__(self):
        self.git_service = GitService()
        self.cache = MetricsCache()

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_path(path: str) -> str:
        """Resolve numstat rename notation to the new path."""
        if "=>" not in path:
            return path
        if "{" in path and "}" in path:
            prefix, rest = path.split("{", 1)
            inner, suffix = rest.split("}", 1)
            new = inner.split("=>", 1)[1].strip()
            return prefix + new + suffix
        return path.split("=>", 1)[1].strip()

    def _apply_mailmap(self, repo: git.Repo, author: str, email: str) -> tuple:
        """Apply .mailmap merging rules if the repository defines them."""
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
                                proper_parts = proper.split('<')
                                if len(proper_parts) == 2:
                                    return proper_parts[0].strip(), proper_parts[1].replace('>', '').strip()
        except Exception:
            pass
        return author, email

    @staticmethod
    def _ts(value: int) -> str:
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # aggregation
    # ------------------------------------------------------------------

    def _aggregate(
        self,
        repo_id: str,
        commit_hash: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        commit_hashes: Optional[List[str]] = None,
    ) -> Dict:
        """Single pass over the commit set producing every metric table."""
        default_set = not (commit_hash or start_time or end_time or commit_hashes)
        if default_set:
            cached = self.cache.get(repo_id, f"bundle_{CACHE_V}")
            if cached:
                return cached

        repo = self.git_service.get_repo(repo_id)

        args: List[str] = []
        if commit_hash:
            args.append(commit_hash)
        else:
            args.append("--no-merges")
            if start_time:
                args += ["--since", self._ts(start_time)]
            if end_time:
                args += ["--until", self._ts(end_time)]
            if commit_hashes:
                args += list(commit_hashes)

        pretty = "--pretty=format:\x1f%H\x1f%an\x1f%ae"
        raw = repo.git.log(*args, "--numstat", pretty)

        files: Dict[str, Dict] = defaultdict(lambda: {"added": 0, "removed": 0, "modifications": 0})
        dirs: Dict[str, Dict] = defaultdict(lambda: {"added": 0, "removed": 0, "modifications": 0})
        authors: Dict[str, Dict] = defaultdict(
            lambda: {"added": 0, "removed": 0, "modifications": 0, "file_churn": defaultdict(int)}
        )
        repo_agg = {"added": 0, "removed": 0, "modifications": 0}
        commit_count = 0

        current = None  # (author_name, author_email)
        touched: set = set()
        changed = False

        def flush_commit():
            nonlocal touched, changed
            if current is None:
                return
            if changed:
                repo_agg["modifications"] += 1
                authors[current]["modifications"] += 1
            for obj in touched:
                dirs[obj]["modifications"] += 1
            touched = set()
            changed = False

        for line in raw.split("\n"):
            if line.startswith("\x1f"):
                flush_commit()
                _, _sha, name, email = line.split("\x1f")
                name, email = self._apply_mailmap(repo, name, email)
                current = f"{name} <{email}>"
                commit_count += 1
                continue
            if not line.strip() or current is None:
                continue
            parts = line.split("\t")
            if len(parts) != 3:
                continue
            added_str, removed_str, raw_path = parts
            if added_str == "-" or removed_str == "-":
                continue  # binary file
            added, removed = int(added_str), int(removed_str)
            path = self._resolve_path(raw_path)

            f = files[path]
            f["added"] += added
            f["removed"] += removed

            author = authors[current]
            author["added"] += added
            author["removed"] += removed
            author["file_churn"][path] += added + removed

            # Zero-line entries (pure renames) create the file entry but
            # do not count as modifications anywhere.
            if added + removed == 0:
                continue

            changed = True
            f["modifications"] += 1

            dir_path = os.path.dirname(path)
            while dir_path:
                touched.add(dir_path)
                dir_path = os.path.dirname(dir_path)
            touched.add("/")
        flush_commit()

        # Roll file totals up into every ancestor directory (subtree sum).
        for path, f in files.items():
            dir_path = os.path.dirname(path)
            while True:
                key = dir_path if dir_path else "/"
                d = dirs[key]
                d["added"] += f["added"]
                d["removed"] += f["removed"]
                if not dir_path:
                    break
                dir_path = os.path.dirname(dir_path)

        repo_agg["added"] = dirs["/"]["added"] if "/" in dirs else 0
        repo_agg["removed"] = dirs["/"]["removed"] if "/" in dirs else 0
        repo_churn = repo_agg["added"] + repo_agg["removed"]

        def rates(churn: int, modifications: int) -> Dict:
            return {
                "modification_frequency": modifications / commit_count if commit_count else 0.0,
                "churn_rate": churn / commit_count if commit_count else 0.0,
            }

        def row(path: str, agg: Dict) -> Dict:
            churn = agg["added"] + agg["removed"]
            return {
                "path": path,
                "added_lines": agg["added"],
                "removed_lines": agg["removed"],
                "growth": agg["added"] - agg["removed"],
                "churn": churn,
                "modifications": agg["modifications"],
                **rates(churn, agg["modifications"]),
            }

        file_rows = [row(p, files[p]) for p in sorted(files)]
        # The root "/" is reported as the repository object, not a directory
        dir_rows = [row(p, dirs[p]) for p in sorted(dirs) if p != "/"]
        repository_row = {
            **row("/", repo_agg),
            "commit_count": commit_count,
            "total_files": len(files),
        }

        author_rows = []
        for key in sorted(authors, key=lambda k: -(authors[k]["added"] + authors[k]["removed"])):
            agg = authors[key]
            churn = agg["added"] + agg["removed"]
            lt = key.rfind("<")
            name, email = key[:lt].strip(), key[lt + 1:-1]
            file_ownership = {
                p: c / (files[p]["added"] + files[p]["removed"])
                for p, c in agg["file_churn"].items()
                if files[p]["added"] + files[p]["removed"] > 0
            }
            author_rows.append({
                "author": name,
                "email": email,
                "added_lines": agg["added"],
                "removed_lines": agg["removed"],
                "growth": agg["added"] - agg["removed"],
                "churn": churn,
                "modifications": agg["modifications"],
                "ownership": churn / repo_churn if repo_churn else 0.0,
                "file_ownership": file_ownership,
            })

        bundle = {
            "files": file_rows,
            "directories": dir_rows,
            "repository": repository_row,
            "authors": author_rows,
        }
        if default_set:
            self.cache.set(repo_id, f"bundle_{CACHE_V}", bundle)
        return bundle

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def get_file_metrics(self, repo_id: str, commit_hash: Optional[str] = None) -> List[Dict]:
        """Get metrics for all files"""
        return self._aggregate(repo_id, commit_hash)["files"]

    def get_directory_metrics(self, repo_id: str, commit_hash: Optional[str] = None) -> List[Dict]:
        """Get metrics for all directories"""
        return self._aggregate(repo_id, commit_hash)["directories"]

    def get_repository_metrics(self, repo_id: str, commit_hash: Optional[str] = None) -> Dict:
        """Get metrics for the entire repository"""
        return self._aggregate(repo_id, commit_hash)["repository"]

    def get_author_metrics(self, repo_id: str, commit_hash: Optional[str] = None) -> List[Dict]:
        """Get metrics for all authors"""
        return self._aggregate(repo_id, commit_hash)["authors"]

    def get_commit_set_metrics(
        self,
        repo_id: str,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        commit_hashes: Optional[List[str]] = None,
    ) -> Dict:
        """Get metrics for a specific commit set"""
        repo_row = self._aggregate(repo_id, None, start_time, end_time, commit_hashes)["repository"]
        return {**repo_row, "files_modified": repo_row["total_files"]}
