from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class FileMetrics(BaseModel):
    path: str
    added_lines: int = 0
    removed_lines: int = 0
    growth: int = 0
    churn: int = 0

class DirectoryMetrics(BaseModel):
    path: str
    added_lines: int = 0
    removed_lines: int = 0
    growth: int = 0
    churn: int = 0

class RepositoryMetrics(BaseModel):
    added_lines: int = 0
    removed_lines: int = 0
    growth: int = 0
    churn: int = 0
    total_files: int = 0
    total_directories: int = 0

class AuthorMetrics(BaseModel):
    author: str
    email: str
    modifications: int = 0
    churn: int = 0
    ownership: Dict[str, float] = {}  # file path -> ownership percentage

class CommitInfo(BaseModel):
    hash: str
    author: str
    email: str
    date: datetime
    message: str
    added_lines: int = 0
    removed_lines: int = 0

class RepoInfo(BaseModel):
    id: str
    name: str
    path: str
    total_commits: int
    total_files: int
    total_authors: int
    created_at: datetime
