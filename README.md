# Repo Analysis Tool (RAT)

This is my submission for the SDP test. It's a web app where you give it a git
repository (either clone it from a URL or upload a zip) and it reports metrics
about the code: lines added/removed per file, growth and churn, rollups per
directory, per-author stats, and a few charts showing how the repo changed
over time.

The backend is FastAPI in Python, the frontend is React with TypeScript on
Vite.

## What you need

- Python 3 with pip (I developed on 3.12, anything 3.10+ should be fine)
- Node.js and npm (I'm on Node 18)
- git on your PATH, the backend shells out to it when cloning

## How to run

Install the dependencies once:

    cd backend
    pip install -r requirements.txt
    cd ../frontend
    npm install
    cd ..

After that the easiest way is the script in the repo root:

    ./start.sh

It brings up both servers and prints the URLs, Ctrl+C stops both of them.

If you'd rather run them separately, open two terminals:

    # terminal 1, backend on port 8000
    cd backend
    uvicorn app.main:app --host 0.0.0.0 --port 8000

    # terminal 2, frontend on port 5173
    cd frontend
    npm run dev

Then open http://localhost:5173 in a browser. The API itself lives on
http://localhost:8000, and http://localhost:8000/docs has a swagger page which
is handy if you want to poke at the endpoints without the UI.

## Using it

1. On the upload page paste the URL of a public repo and hit clone, or upload
   a zip of one. Cloning takes a few seconds on bigger repos.
2. The repo then shows up as a card on the dashboard, click it.
3. You get tables and charts for file, directory, author and whole-repo
   metrics.

## A few notes

- Cloned repos are kept under backend/repos/ and computed metrics are cached
  as json in backend/cache/, so reopening a repo you already analysed is
  instant. Delete those two folders if you want everything recomputed from
  scratch.
- If you change backend code and it doesn't seem to take effect, kill uvicorn
  and start it again, --reload misses things now and then.
- Built and tested on Ubuntu 24.04.

## Metric definitions

- churn = lines added + lines removed
- growth = lines added - lines removed
- author ownership = that author's share of all changes to a file
- merge commits are excluded from all of the above

## Layout

    backend/    FastAPI app, app/api has the routes and app/services the metric logic
    frontend/   React app, src/pages and src/components
    start.sh    starts both servers
