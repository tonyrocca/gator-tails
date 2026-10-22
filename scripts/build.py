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
# full rank history across all editions up to this one (for the week-over-week chart)
hist_eds = eds[: (idx + 1)] if idx is not None else [Path(ed_path)]
history, labels = {}, []
for p_ in hist_eds:
    J = json.load(open(p_)); labels.append(J.get("title", J["id"]).replace("Week ", "W"))
    for r in J.get("rankings", []): history.setdefault(str(r["team"]), []).append(r["rank"])
if idx:
    P = json.load(open(eds[idx - 1]))
    prev = {str(r["team"]): r["rank"] for r in P.get("rankings", [])}
C = json.load(open(ROOT / f"data/computed_{E['season']}.json"))
tpl = open(ROOT / "scripts/template.html").read()
title = f"{C['league']} {E['title']} Power Rankings {E['season']}"
board = sorted(E["rankings"], key=lambda r: r["rank"])
teams = {t["id"]: t for t in C["teams"]}
KEEP = ("id", "name", "abbrev", "logo", "manager", "draftSlot", "startPts", "benchPts", "starters", "steals", "reaches", "modelRank", "modelGrade", "history", "qbs", "kickerRound", "record", "weekly", "standing")
# as-of week: rebuild records/standings/top scorer from weekly results up to this edition's week
wk = E.get("week", 0) or 0
for t in C["teams"]:
    ws = [w for w in t.get("weekly", []) if w["wk"] <= wk]
    t["weekly"] = ws
    t["record"] = {"w": sum(1 for w in ws if w["win"]), "l": sum(1 for w in ws if not w["win"]), "pf": round(sum(w["pts"] for w in ws), 2), "pa": round(sum(w["oppPts"] for w in ws), 2)}
for i, t in enumerate(sorted(C["teams"], key=lambda t: (-t["record"]["w"], -t["record"]["pf"]))): t["standing"] = i + 1
if wk:
    lw = [(t["id"], next((w["pts"] for w in t["weekly"] if w["wk"] == wk), 0)) for t in C["teams"]]
    C["leagueFacts"]["topScorerLastWeek"] = max(lw, key=lambda x: x[1])
    C["leagueFacts"]["weeksPlayed"] = wk
# bench report + season high for this edition's week
bench, season_high = [], 0
try:
    BX = json.load(open(ROOT / f"data/box_{E['season']}.json"))
    FLEX, OP = {"RB", "WR", "TE"}, {"QB", "RB", "WR", "TE"}
    def optimal(players):
        pool = sorted(players, key=lambda p: -p["pts"]); used = set(); tot = 0
        for allowed in [{"QB"}, {"RB"}, {"RB"}, {"WR"}, {"WR"}, {"TE"}, OP, FLEX, {"K"}]:
            for p in pool:
                if p["id"] not in used and p["pos"] in allowed: used.add(p["id"]); tot += p["pts"]; break
        return round(tot, 1)
    for w in range(1, wk + 1):
        for g in BX.get(str(w), []):
            for side in ("home", "away"):
                season_high = max(season_high, g[side]["pts"] or 0)
    for g in BX.get(str(wk), []):
        for side, other in (("home", "away"), ("away", "home")):
            s_, o_ = g[side], g[other]
            act = [p for p in s_["players"] if p["slot"] not in ("BN", "IR")]
            opt = optimal([p for p in s_["players"] if p["slot"] != "IR"])
            topb = max([p for p in s_["players"] if p["slot"] == "BN"], key=lambda p: p["pts"], default=None)
            bench.append({"team": s_["team"], "pts": s_["pts"], "opt": opt, "left": round(opt - s_["pts"], 1), "opp": o_["team"], "oppPts": o_["pts"],
                          "won": s_["pts"] > o_["pts"], "wouldWin": opt > o_["pts"] and s_["pts"] <= o_["pts"], "topBench": topb and {"name": topb["name"], "pts": topb["pts"]}})
    bench.sort(key=lambda x: -x["left"])
except Exception as ex:
    print("bench report skipped:", ex)
C["leagueFacts"]["benchReport"] = bench
# blind resume (edition.blindResume): anonymous key stats per team, lettered in a fixed shuffled order
resumes = []
if E.get("blindResume") and wk:
    import random
    ids = sorted(t["id"] for t in C["teams"]); random.Random(E["id"]).shuffle(ids)
    sc = {w: {t["id"]: next((x["pts"] for x in t["weekly"] if x["wk"] == w), 0) for t in C["teams"]} for w in range(1, wk + 1)}
    left = {t["id"]: 0.0 for t in C["teams"]}
    for w in range(1, wk + 1):
        for g in BX.get(str(w), []):
            for side in ("home", "away"):
                s_ = g[side]; left[s_["team"]] += optimal([p for p in s_["players"] if p["slot"] != "IR"]) - s_["pts"]
    pfr = {t["id"]: k + 1 for k, t in enumerate(sorted(C["teams"], key=lambda t: -t["record"]["pf"]))}
    ordn = lambda n: f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"
    for k, tid in enumerate(ids):
        t = teams[tid]; ws = t["weekly"]; n = len(ws)
        W = t["record"]["w"]; L = t["record"]["l"]; pf = t["record"]["pf"]
        ap = sum(1 for w in ws for o, v in sc[w["wk"]].items() if o != tid and w["pts"] > v); apl = 9 * n - ap
        l3 = sum(w["pts"] for w in ws[-3:]) / min(3, n); hi = max(w["pts"] for w in ws); lo = min(w["pts"] for w in ws)
        stk = 0
        for w in reversed(ws):
            if w["win"] != ws[-1]["win"]: break
            stk += 1
        resumes.append({"letter": "ABCDEFGHIJKLMNOP"[k], "team": tid, "stats": [
            {"l": "Record", "d": f"{W}-{L}", "v": W},
            {"l": "Points per week", "d": f"{pf / n:.1f}", "sub": ordn(pfr[tid]), "v": pf},
            {"l": "All-play record", "d": f"{ap}-{apl}", "v": ap},
            {"l": "Last 3 weeks", "d": f"{l3:.1f}", "v": round(l3, 2)},
            {"l": "Best week", "d": f"{hi:.1f}", "v": hi},
            {"l": "Worst week", "d": f"{lo:.1f}", "v": lo},
            {"l": "Streak", "d": ("W" if ws[-1]["win"] else "L") + str(stk), "v": stk if ws[-1]["win"] else -stk},
            {"l": "Bench pts left", "d": f"{left[tid]:.0f}", "v": -round(left[tid], 1)}]})
C["leagueFacts"]["seasonHigh"] = season_high
slim = {"season": C["season"], "league": C["league"], "teams": [{k: t[k] for k in KEEP if k in t} for t in C["teams"]], "leagueFacts": C["leagueFacts"]}
desc = E.get("ogDesc") or (" · ".join(f"{r['rank']}. {teams[r['team']]['name']}" for r in board[:3]) + " …")
html = (tpl.replace("__TITLE__", title).replace("__DESC__", desc)
        .replace("__DATA__", json.dumps({"edition": E, "computed": slim, "prev": prev, "history": history, "historyLabels": labels, "site": site_url,
    "archive": [{"id": json.load(open(p_))["id"], "title": json.load(open(p_)).get("title"), "date": json.load(open(p_)).get("date")} for p_ in eds],
    "latest": json.load(open(eds[-1]))["id"], "resumes": resumes}, separators=(",", ":")).replace("</", "<\\/")))
out = ROOT / "site"; out.mkdir(exist_ok=True)
if E["id"] == json.load(open(eds[-1]))["id"]: (out / "index.html").write_text(html)
(out / E["id"]).mkdir(exist_ok=True); (out / E["id"] / "index.html").write_text(html)
print("built", out / "index.html", "and", out / E["id"] / "index.html", f"({len(html)//1024} KB)")
