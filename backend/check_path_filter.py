"""Cross-check the file/directory path filter against raw git and the unfiltered tables."""
import subprocess
import json
import urllib.request
import urllib.parse

R = '4fc7c906-b329-4b26-b123-fd18d7ca7baf'
BASE = f'http://localhost:8000/api/metrics/{R}'


def get(p):
    with urllib.request.urlopen(f'{BASE}/{p}') as r:
        return json.load(r)['metrics']


dirs = get('directories')
files = get('files')
scope_dir = dirs[0]['path']
scope_file = next(f['path'] for f in files if f['churn'] > 100)
print('scope dir:', scope_dir, '| scope file:', scope_file)

# --- directory scope vs git pathspec sums ---
out = subprocess.run(['git', '-C', f'repos/{R}', 'log', '--no-merges', '--numstat',
                      '--pretty=format:x', '--', scope_dir + '/'],
                     capture_output=True, text=True).stdout
a = r = 0
for line in out.split('\n'):
    p = line.split('\t')
    if len(p) == 3 and p[0] != '-':
        a += int(p[0])
        r += int(p[1])
q = urllib.parse.quote(scope_dir)
api = get(f'repository?path={q}')
print('git dir sums:', a, r, '| api:', api['added_lines'], api['removed_lines'])
assert (a, r) == (api['added_lines'], api['removed_lines']), 'DIR SCOPE MISMATCH'
ref_row = next(d for d in dirs if d['path'] == scope_dir)
assert api['churn'] == ref_row['churn'] and api['modifications'] == ref_row['modifications']
assert api['commit_count'] == 955, 'commit_count must stay |H|'

# scoped tables only contain objects inside the scope
sfiles = get(f'files?path={q}')
sdirs = get(f'directories?path={q}')
assert all(f['path'] == scope_dir or f['path'].startswith(scope_dir + '/') for f in sfiles)
assert all(d['path'].startswith(scope_dir + '/') for d in sdirs)
assert len(sfiles) == len([f for f in files if f['path'].startswith(scope_dir + '/')])
assert len(sdirs) == len([d for d in dirs if d['path'].startswith(scope_dir + '/')])
print('scoped tables:', len(sfiles), 'files,', len(sdirs), 'subdirs - OK')

# --- file scope equals the unfiltered file row ---
qf = urllib.parse.quote(scope_file)
apif = get(f'repository?path={qf}')
ref_file = next(f for f in files if f['path'] == scope_file)
for k in ('added_lines', 'removed_lines', 'growth', 'churn', 'modifications'):
    assert apif[k] == ref_file[k], f'FILE SCOPE MISMATCH {k}'
print('file scope matches unfiltered row - OK')

# --- authors scoped to the dir sum to the dir churn ---
sauth = get(f'authors?path={q}')
total = sum(x['churn'] for x in sauth)
assert total == api['churn'], (total, api['churn'])
assert abs(sum(x['ownership'] for x in sauth) - 1.0) < 1e-9
print('scoped authors sum to scope churn - OK')
print('ALL PATH FILTER CHECKS PASSED')
