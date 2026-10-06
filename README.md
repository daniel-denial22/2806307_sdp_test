# Repo Analysis Tool (RAT)

A web dashboard for analyzing Git repositories and visualizing code metrics.

## Features

- **Repository Input**: Upload ZIP files or clone from URLs
- **File Metrics**: Track added/removed lines, growth, and churn per file
- **Directory Metrics**: Aggregate metrics for directories
- **Repository Metrics**: Overall repository statistics
- **Author Metrics**: Track contributions per developer
- **Commit Set Metrics**: Analyze specific time periods or commit ranges
- **Author Merging**: Support for .mailmap files
- **Multiple Repository Support**: Manage multiple repos in one dashboard

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **GitPython** - Git repository operations
- **Pydantic** - Data validation

### Frontend
- **React** with TypeScript
- **Vite** - Fast build tool
- **React Router** - Navigation
- **Recharts** - Data visualization
- **Axios** - HTTP client

## Project Structure

```
2806307_sdp_test/
├── backend/
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── models/       # Data models
│   │   ├── services/     # Business logic
│   │   └── main.py       # FastAPI app
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API calls
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Setup Instructions

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API will be available at http://localhost:8000
API documentation at http://localhost:8000/docs

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at http://localhost:5173

## Usage

1. Start the backend server
2. Start the frontend development server
3. Open http://localhost:5173 in your browser
4. Upload a repository (ZIP) or clone from URL
5. View metrics in the dashboard

## Metrics Explained

### File Metrics
- **Added Lines**: Lines added to the file
- **Removed Lines**: Lines removed from the file
- **Growth**: Net change (added - removed)
- **Churn**: Total activity (added + removed)

### Directory Metrics
- Aggregated metrics for all files and subdirectories

### Repository Metrics
- Overall statistics for the entire repository

### Author Metrics
- **Modifications**: Number of commits that touched files
- **Churn**: Total lines changed by the author
- **Ownership**: Percentage of changes per file

## Development

### Running Tests
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## License

MIT
