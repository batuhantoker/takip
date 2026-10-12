#!/usr/bin/env python3
"""Merge BRANCH into the checked-out branch of a shared, dirty tree (several sessions, one working copy).

Usage: python3 tools/land-branch.py BRANCH "merge message" [--apply] [--resolved=DIR] [--delete-dirty]

Clean files take the merged blob; files with other sessions' uncommitted edits get a
3-way merge (their working copy + our delta) and keep those edits unstaged.
Dry run by default; --apply writes. Run from the repo root.
"""
import os
import subprocess
import sys
import tempfile


def git(*args, data=None, check=True):
    r = subprocess.run(['git', *args], input=data, capture_output=True)
    if check and r.returncode:
        sys.exit(f'git {" ".join(args)} failed:\n{r.stderr.decode()}{r.stdout.decode()}')
    return r


def out(*args):
    return git(*args).stdout.decode().strip()


def read(path):
    return open(path, 'rb').read() if os.path.lexists(path) else None


branch, message = sys.argv[1], sys.argv[2]
apply = '--apply' in sys.argv[3:]
resolved = next((a.split('=', 1)[1] for a in sys.argv[3:] if a.startswith('--resolved=')), None)
conflict_dir = os.path.join(tempfile.gettempdir(), 'land-branch-conflicts')
conflicts = []
ref, head, tip = out('symbolic-ref', 'HEAD'), out('rev-parse', 'HEAD'), out('rev-parse', branch)

mt = git('merge-tree', '--write-tree', head, tip, check=False)
if mt.returncode:
    sys.exit('merge conflicts between HEAD and ' + branch + ':\n' + mt.stdout.decode())
tree = mt.stdout.decode().splitlines()[0]

staged = set(out('diff', '--cached', '--name-only').split('\n')) - {''}
plan = []
for line in out('diff', '--name-status', '--no-renames', head, tree).splitlines():
    status, path = line.split('\t', 1)
    if path in staged:
        sys.exit(f'{path}: has staged changes in the index; stop')
    old = None if status == 'A' else git('show', f'{head}:{path}').stdout
    new = None if status == 'D' else git('show', f'{tree}:{path}').stdout
    mode = None if new is None else out('ls-tree', tree, '--', path).split()[0]
    cur = read(path)
    if cur == old:
        plan.append((path, cur, new, new, mode, 'clean'))
        continue
    if new is None and '--delete-dirty' in sys.argv[3:]:
        plan.append((path, cur, None, None, None, 'dirty, deleted'))
        continue
    if old is None or new is None or cur is None:
        sys.exit(f'{path}: dirty in the tree and added/deleted by {branch}; resolve by hand (or --delete-dirty)')
    with tempfile.TemporaryDirectory() as d:
        names = []
        for n, b in (('cur', cur), ('base', old), ('new', new)):
            names.append(os.path.join(d, n))
            open(names[-1], 'wb').write(b)
        r = subprocess.run(['git', 'merge-file', '-p', *names], capture_output=True)
    flat = path.replace('/', '__')
    if r.returncode:
        given = resolved and os.path.join(resolved, flat)
        if given and os.path.exists(given):
            work = open(given, 'rb').read()
            if b'<<<<<<<' in work or b'>>>>>>>' in work:
                sys.exit(f'{given} still has conflict markers')
            plan.append((path, cur, work, new, mode, 'dirty, hand-resolved'))
            continue
        os.makedirs(conflict_dir, exist_ok=True)
        open(os.path.join(conflict_dir, flat), 'wb').write(r.stdout)
        conflicts.append(path)
        continue
    plan.append((path, cur, r.stdout, new, mode, 'dirty, 3-way merged'))

for path, *_, kind in plan:
    print(f'{kind:22} {path}')
if conflicts:
    sys.exit('conflicts with uncommitted edits; resolve these and pass --resolved=DIR:\n' +
             '\n'.join(f'  {c} -> {os.path.join(conflict_dir, c.replace("/", "__"))}' for c in conflicts))
if not apply:
    print('dry run; pass --apply to land')
    sys.exit(0)

for path, cur, *_ in plan:
    if read(path) != cur:
        sys.exit(f'{path} changed while landing; nothing written, rerun')

commit = out('commit-tree', tree, '-p', head, '-p', tip, '-m', message)
for path, _cur, work, idx, mode, _kind in plan:
    if work is None:
        if os.path.lexists(path):
            os.remove(path)
        git('update-index', '--force-remove', '--', path)
        continue
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    open(path, 'wb').write(work)
    if mode == '100755':
        os.chmod(path, 0o755)
    blob = git('hash-object', '-w', '--stdin', data=idx).stdout.decode().strip()
    git('update-index', '--add', '--cacheinfo', f'{mode},{blob},{path}')
git('update-ref', ref, commit, head)
print('landed', commit[:9], 'on', ref)
