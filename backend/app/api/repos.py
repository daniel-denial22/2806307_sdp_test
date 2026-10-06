from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Query
from fastapi.responses import JSONResponse
from app.services.git_service import GitService
import shutil
import os

router = APIRouter()

@router.post("/upload")
async def upload_repository(
    file: UploadFile = File(...),
):
    """Upload a repository as a ZIP file"""
    try:
        git_service = GitService()
        repo_id = await git_service.process_zip_upload(file)
        return {"repo_id": repo_id, "message": "Repository uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/clone")
async def clone_repository(
    url: str = Form(...)
):
    """Clone a repository from a URL"""
    try:
        git_service = GitService()
        repo_id = await git_service.clone_repository(url)
        return {"repo_id": repo_id, "message": "Repository cloned successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/")
async def list_repositories():
    """List all uploaded/cloned repositories"""
    git_service = GitService()
    repos = git_service.list_repositories()
    return {"repositories": repos}

@router.get("/{repo_id}")
async def get_repository(repo_id: str):
    """Get repository information"""
    git_service = GitService()
    repo_info = git_service.get_repository_info(repo_id)
    if not repo_info:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo_info

@router.get("/{repo_id}/commits")
async def list_commits(
    repo_id: str,
    limit: int = Query(1000, ge=1, le=100000),
):
    """List non-merge commits for manual commit-set selection"""
    try:
        git_service = GitService()
        return {"commits": git_service.list_commits(repo_id, limit)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{repo_id}")
async def delete_repository(repo_id: str):
    """Delete a repository"""
    try:
        git_service = GitService()
        git_service.delete_repository(repo_id)
        return {"message": "Repository deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
