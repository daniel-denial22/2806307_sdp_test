"""Cross-check the author filter against raw git numstat output."""
import subprocess
import json
import urllib.request
import urllib.parse

R = '4fc7c906-b329-4b26-b123-fd18d7ca7baf'
authors = json.load(urllib.request.urlopen(f'http://localhost:8000/api/metrics/{R}/authors'))['metrics']
key = f"{authors[0]['author']} <{authors[0]['email']}>"
print('author:', key)

out = subprocess.run(['git', '-C', f'repos/{R}', 'log', '--no-merges', '--numstat',
                      '--pretty=format:\x1f%an\x1f%ae'], capture_output=True, text=True).stdout
inc = False
a = r = n = 0
for line in out.split('\n'):
    if line.startswith('\x1f'):
        _, name, email = line.split('\x1f')
        inc = f"{name} <{email}>" == key
        if inc:
            n += 1
        continue
    if not inc or not line.strip():
        continue
    p = line.split('\t')
    if len(p) == 3 and p[0] != '-':
        a += int(p[0])
        r += int(p[1])

api = json.load(urllib.request.urlopen(
    f'http://localhost:8000/api/metrics/{R}/repository?author={urllib.parse.quote(key)}'))['metrics']
print('git:', n, a, r, '| api:', api['commit_count'], api['added_lines'], api['removed_lines'])
assert (n, a, r) == (api['commit_count'], api['added_lines'], api['removed_lines']), 'AUTHOR FILTER MISMATCH'
print('OK: author filter matches git exactly')
