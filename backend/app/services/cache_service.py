import git
import os
import json
from typing import Dict, Optional
from pathlib import Path

class MetricsCache:
    def __init__(self):
        self.cache_dir = os.path.join(os.path.dirname(__file__), "../../cache")
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_cache_path(self, repo_id: str, metric_type: str) -> str:
        return os.path.join(self.cache_dir, f"{repo_id}_{metric_type}.json")

    def get(self, repo_id: str, metric_type: str) -> Optional[Dict]:
        cache_path = self._get_cache_path(repo_id, metric_type)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r') as f:
                    return json.load(f)
            except:
                pass
        return None

    def set(self, repo_id: str, metric_type: str, data: Dict):
        cache_path = self._get_cache_path(repo_id, metric_type)
        try:
            with open(cache_path, 'w') as f:
                json.dump(data, f)
        except:
            pass

    def invalidate(self, repo_id: str):
        """Clear all cached metrics for a repository"""
        for file in os.listdir(self.cache_dir):
            if file.startswith(repo_id):
                os.remove(os.path.join(self.cache_dir, file))
