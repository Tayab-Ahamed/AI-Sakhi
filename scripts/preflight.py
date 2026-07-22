#!/usr/bin/env python3
"""Fail-fast deployment preflight checks."""
from __future__ import annotations
import os,secrets,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.observability import validate_production_config

errors=validate_production_config()
if os.getenv('SAKHI_ENV')!='production': errors.append('SAKHI_ENV must be production')
if os.getenv('SAKHI_ENABLE_DEMO_SEED','').lower() in {'1','true','yes'}: errors.append('Demo seeding must be disabled')
data=Path(os.getenv('DB_PATH','data/sakhi.db')).parent
try:
    data.mkdir(parents=True,exist_ok=True); probe=data/f'.write-{secrets.token_hex(4)}'; probe.write_text('ok'); probe.unlink()
except Exception as exc: errors.append(f'Database directory is not writable: {exc}')
if errors:
    print('PRE-FLIGHT FAILED'); [print(f'- {item}') for item in errors]; raise SystemExit(1)
print('PRE-FLIGHT PASSED')
