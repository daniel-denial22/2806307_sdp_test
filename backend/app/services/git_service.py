import git
import os
import shutil
import zipfile
import tempfile
from typing import List, Dict, Optional
from fastapi import UploadFile
from app.models.schemas import CommitInfo, RepoInfo
from app.services.cache_service import MetricsCache
import uuid

class GitService:
    def __init__(self):
        self.repos_dir = os.path.join(os.path.dirname(__file__), "../../repos")
        os.makedirs(self.repos_dir, exist_ok=True)

    async def process_zip_upload(self, file: UploadFile) -> str:
        """Process uploaded ZIP file and extract repository"""
        repo_id = str(uuid.uuid4())
        repo_path = os.path.join(self.repos_dir, repo_id)
        
        # Save uploaded file
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        try:
            with open(temp_zip.name, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Extract ZIP
            os.makedirs(repo_path, exist_ok=True)
            with zipfile.ZipFile(temp_zip.name, 'r') as zip_ref:
                zip_ref.extractall(repo_path)
            
            # Find .git directory
            git_dir = None
            for root, dirs, files in os.walk(repo_path):
                if '.git' in dirs:
                    git_dir = os.path.join(root, '.git')
                    break
            
            if not git_dir:
                shutil.rmtree(repo_path)
                raise ValueError("No .git directory found in ZIP file")
            
            return repo_id
        finally:
            os.unlink(temp_zip.name)

    async def clone_repository(self, url: str) -> str:
        """Clone a repository from URL"""
        repo_id = str(uuid.uuid4())
        repo_path = os.path.join(self.repos_dir, repo_id)
        
        try:
            git.Repo.clone_from(url, repo_path)
            return repo_id
        except Exception as e:
            if os.path.exists(repo_path):
                shutil.rmtree(repo_path)
            raise ValueError(f"Failed to clone repository: {str(e)}")

    def list_repositories(self) -> List[Dict]:
        """List all repositories"""
        repos = []
        if os.path.exists(self.repos_dir):
            for repo_id in os.listdir(self.repos_dir):
                repo_path = os.path.join(self.repos_dir, repo_id)
                if os.path.isdir(repo_path):
                    try:
                        repo = git.Repo(repo_path)
                        repos.append({
                            "id": repo_id,
                            "name": os.path.basename(repo.remotes.origin.url) if repo.remotes else repo_id,
                            "path": repo_path,
                        })
                    except:
                        pass
        return repos

    def get_repository_info(self, repo_id: str) -> Optional[Dict]:
        """Get repository information"""
        repo_path = os.path.join(self.repos_dir, repo_id)
        if not os.path.exists(repo_path):
            return None
        
        try:
            repo = git.Repo(repo_path)
            commits = list(repo.iter_commits('HEAD'))
            authors = set(c.author.email for c in commits)
            
            # Count files
            files = []
            for item in repo.tree().traverse():
                if item.type == 'blob':
                    files.append(item.path)
            
            return {
                "id": repo_id,
                "name": os.path.basename(repo.remotes.origin.url) if repo.remotes else repo_id,
                "path": repo_path,
                "total_commits": len(commits),
                "total_files": len(files),
                "total_authors": len(authors),
            }
        except Exception as e:
            return None

    def delete_repository(self, repo_id: str):
        """Delete a repository"""
        repo_path = os.path.join(self.repos_dir, repo_id)
        if os.path.exists(repo_path):
            shutil.rmtree(repo_path)
        
        # Invalidate cache
        cache = MetricsCache()
        cache.invalidate(repo_id)

    def get_repo(self, repo_id: str) -> git.Repo:
        """Get git.Repo object"""
        repo_path = os.path.join(self.repos_dir, repo_id)
        if not os.path.exists(repo_path):
            raise ValueError("Repository not found")
        return git.Repo(repo_path)
