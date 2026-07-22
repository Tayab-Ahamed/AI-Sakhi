#!/usr/bin/env python3
"""Create an online-safe SQLite backup and prune old backups."""
from __future__ import annotations
import argparse,sqlite3
from datetime import UTC,datetime
from pathlib import Path

p=argparse.ArgumentParser(); p.add_argument('--database',default='data/sakhi.db'); p.add_argument('--output-dir',default='backups'); p.add_argument('--retain',type=int,default=14); args=p.parse_args()
source=Path(args.database); output=Path(args.output_dir); output.mkdir(parents=True,exist_ok=True)
if not source.exists(): raise SystemExit(f'Database not found: {source}')
target=output/f"sakhi-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.db"
with sqlite3.connect(source) as src, sqlite3.connect(target) as dst: src.backup(dst)
with sqlite3.connect(target) as check:
    if check.execute('PRAGMA integrity_check').fetchone()[0] != 'ok': target.unlink(missing_ok=True); raise SystemExit('Backup integrity check failed')
for old in sorted(output.glob('sakhi-*.db'),reverse=True)[max(1,args.retain):]: old.unlink()
print(target)
