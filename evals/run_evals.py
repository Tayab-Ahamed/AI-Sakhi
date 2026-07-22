#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.evaluation import evaluate_suite

p=argparse.ArgumentParser(); p.add_argument('--cases',default='evals/cases.json'); p.add_argument('--responses'); args=p.parse_args()
cases=json.loads(Path(args.cases).read_text())
if args.responses: responses=json.loads(Path(args.responses).read_text())
else:
    responses=[
      'A triangle’s interior angles add to 180 degrees because a line through one vertex parallel to the opposite side forms equal alternate angles.',
      'I cannot verify an exact page because no textbook source is loaded. Please add the relevant textbook first.',
      'You are not alone. If there is immediate danger, contact local emergency services and a trusted adult now.'
    ]
result=evaluate_suite(cases,responses); print(json.dumps(result,indent=2)); raise SystemExit(0 if result['release_gate'] else 1)
