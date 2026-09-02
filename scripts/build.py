#!/usr/bin/env python3
"""Render an edition into site/. Usage: build.py editions/<id>.json [--site https://host]
Writes site/index.html (latest) and site/<id>/index.html (archive)."""
import json, sys, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
site_url = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--site=")), "")
ed_path = Path(args[0]) if args else sorted((ROOT / "editions").glob("*.json"))[-1]
E = json.load(open(ed_path))
# previous edition (for rank movement): the edition file sorted just before this one
eds = sorted((ROOT / "editions").glob("*.json"))
idx = next((k for k, e in enumerate(eds) if e.name == Path(ed_path).name), None)
prev = {}
if idx:
    P = json.load(open(eds[idx - 1]))
    prev = {str(r["team"]): r["rank"] for r in P.get("rankings", [])}
C = json.load(open(ROOT / f"data/computed_{E['season']}.json"))
tpl = open(ROOT / "scripts/template.html").read()
title = f"{C['league']} {E['title']} Power Rankings {E['season']}"
board = sorted(E["rankings"], key=lambda r: r["rank"])
teams = {t["id"]: t for t in C["teams"]}
KEEP = ("id", "name", "abbrev", "logo", "manager", "draftSlot", "startPts", "benchPts", "starters", "steals", "reaches", "modelRank", "modelGrade", "history", "qbs", "kickerRound", "record", "weekly", "standing")
slim = {"season": C["season"], "league": C["league"], "teams": [{k: t[k] for k in KEEP if k in t} for t in C["teams"]], "leagueFacts": C["leagueFacts"]}
desc = " · ".join(f"{r['rank']}. {teams[r['team']]['name']}" for r in board[:3]) + " …"
html = (tpl.replace("__TITLE__", title).replace("__DESC__", desc)
        .replace("__DATA__", json.dumps({"edition": E, "computed": slim, "prev": prev, "site": site_url}, separators=(",", ":")).replace("</", "<\\/")))
out = ROOT / "site"; out.mkdir(exist_ok=True)
(out / "index.html").write_text(html)
(out / E["id"]).mkdir(exist_ok=True); (out / E["id"] / "index.html").write_text(html)
print("built", out / "index.html", "and", out / E["id"] / "index.html", f"({len(html)//1024} KB)")
