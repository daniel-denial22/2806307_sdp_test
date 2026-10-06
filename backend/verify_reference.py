"""Compare RAT API output against a course reference CSV.

Usage:
    python3 verify_reference.py [repo_id] [csv_path]

Defaults to the cJSON clone already present in backend/repos and the
cJSON reference CSV in ~/Desktop/repo-references. The repo_id of a clone
is printed by the app / visible in the repository URL, and must match the
repo the CSV was generated for (check the CSV's repo + ref_sha columns).
"""
import csv
import sys
import urllib.request
import json

REPO_ID = sys.argv[1] if len(sys.argv) > 1 else "4fc7c906-b329-4b26-b123-fd18d7ca7baf"
CSV_PATH = sys.argv[2] if len(sys.argv) > 2 else "/home/vmuser/Desktop/repo-references/cJSON_6d9f2443ab07.csv"
BASE = f"http://localhost:8000/api/metrics/{REPO_ID}"


def get(path):
    with urllib.request.urlopen(f"{BASE}/{path}") as r:
        return json.load(r)["metrics"]


def close(a, b, tol=1e-6):
    return abs(float(a) - float(b)) <= tol * max(1.0, abs(float(b)))


repo = get("repository")
files = {f["path"]: f for f in get("files")}
dirs = {d["path"]: d for d in get("directories")}
authors = {f"{a['author']} <{a['email']}>": a for a in get("authors")}

rows = list(csv.DictReader(open(CSV_PATH)))
mismatches = []
checked = 0

FIELDS = ["added", "removed", "growth", "churn", "modifications",
          "modification_frequency", "churn_rate"]


def cmp(label, ours, ref, fields=FIELDS):
    global checked
    checked += 1
    for f in fields:
        ref_v = ref[f]
        if ref_v == "":
            continue
        our_v = ours.get(f if f not in ("added", "removed") else f + "_lines")
        if our_v is None:
            our_v = ours.get(f)
        if our_v is None or not close(our_v, ref_v):
            mismatches.append(f"{label}.{f}: ours={our_v} ref={ref_v}")


# repository ALL row
ref_repo = next(r for r in rows if r["object_type"] == "repository" and r["author"] == "ALL")
cmp("repository /", repo, ref_repo)
if repo["commit_count"] != int(ref_repo["commit_count"]):
    mismatches.append(f"commit_count: ours={repo['commit_count']} ref={ref_repo['commit_count']}")

# directory + file ALL rows
for r in rows:
    if r["author"] != "ALL":
        continue
    if r["object_type"] == "directory":
        ours = dirs.get(r["path"])
        if ours is None:
            mismatches.append(f"missing dir {r['path']}")
        else:
            cmp(f"dir {r['path']}", ours, r)
    elif r["object_type"] == "file":
        ours = files.get(r["path"])
        if ours is None:
            mismatches.append(f"missing file {r['path']}")
        else:
            cmp(f"file {r['path']}", ours, r)

# author rows at repository level
for r in rows:
    if r["object_type"] == "repository" and r["author"] != "ALL":
        ours = authors.get(r["author"])
        if ours is None:
            mismatches.append(f"missing author {r['author']}")
        else:
            cmp(f"author {r['author']}", ours, r,
                ["added", "removed", "growth", "churn", "modifications", "ownership"])

# extra objects we produce but reference lacks (informational)
extra_dirs = set(dirs) - {r["path"] for r in rows if r["object_type"] == "directory" and r["author"] == "ALL"}
extra_files = set(files) - {r["path"] for r in rows if r["object_type"] == "file" and r["author"] == "ALL"}

print(f"objects checked: {checked}")
print(f"mismatches: {len(mismatches)}")
for m in mismatches[:40]:
    print("  ", m)
print("extra dirs vs ref:", sorted(extra_dirs))
print("extra files vs ref:", sorted(extra_files))
sys.exit(1 if mismatches else 0)
