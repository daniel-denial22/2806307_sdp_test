from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.services.metrics_service import MetricsService

router = APIRouter()


def _hash_list(commit_hashes: Optional[str]) -> Optional[List[str]]:
    return [h.strip() for h in commit_hashes.split(",") if h.strip()] if commit_hashes else None


@router.get("/{repo_id}/files")
async def get_file_metrics(
    repo_id: str,
    start_time: Optional[int] = Query(None, description="UNIX timestamp, inclusive"),
    end_time: Optional[int] = Query(None, description="UNIX timestamp, exclusive"),
    commit_hashes: Optional[str] = Query(None, description="Comma-separated commit hashes"),
):
    """Get metrics for all files in a repository"""
    try:
        metrics_service = MetricsService()
        metrics = metrics_service.get_file_metrics(
            repo_id, start_time, end_time, _hash_list(commit_hashes)
        )
        return {"metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{repo_id}/directories")
async def get_directory_metrics(
    repo_id: str,
    start_time: Optional[int] = Query(None),
    end_time: Optional[int] = Query(None),
    commit_hashes: Optional[str] = Query(None),
):
    """Get metrics for all directories in a repository"""
    try:
        metrics_service = MetricsService()
        metrics = metrics_service.get_directory_metrics(
            repo_id, start_time, end_time, _hash_list(commit_hashes)
        )
        return {"metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{repo_id}/repository")
async def get_repository_metrics(
    repo_id: str,
    start_time: Optional[int] = Query(None),
    end_time: Optional[int] = Query(None),
    commit_hashes: Optional[str] = Query(None),
):
    """Get metrics for the entire repository"""
    try:
        metrics_service = MetricsService()
        metrics = metrics_service.get_repository_metrics(
            repo_id, start_time, end_time, _hash_list(commit_hashes)
        )
        return {"metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{repo_id}/authors")
async def get_author_metrics(
    repo_id: str,
    start_time: Optional[int] = Query(None),
    end_time: Optional[int] = Query(None),
    commit_hashes: Optional[str] = Query(None),
):
    """Get metrics for all authors in a repository"""
    try:
        metrics_service = MetricsService()
        metrics = metrics_service.get_author_metrics(
            repo_id, start_time, end_time, _hash_list(commit_hashes)
        )
        return {"metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{repo_id}/commits")
async def get_commit_set_metrics(
    repo_id: str,
    start_time: Optional[int] = Query(None),
    end_time: Optional[int] = Query(None),
    commit_hashes: Optional[str] = Query(None),  # Comma-separated list
):
    """Get metrics for a commit set"""
    try:
        metrics_service = MetricsService()
        metrics = metrics_service.get_commit_set_metrics(
            repo_id, start_time, end_time, _hash_list(commit_hashes)
        )
        return {"metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
