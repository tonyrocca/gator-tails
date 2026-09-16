#!/usr/bin/env python3
"""Week-in-review facts from data/box_<season>.json + league file. Usage: weekly.py <season> <week>"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
season, wk = sys.argv[1], int(sys.argv[2])
L = json.load(open(ROOT / f"data/league_{season}.json")); B = json.load(open(ROOT / f"data/box_{season}.json"))[str(wk)]
P = json.load(open(ROOT / "data/people.json"))
T = {t["id"]: t for t in L["teams"]}
nick = lambda i: P[str(i)]["nick"]
FLEX = {"RB","WR","TE"}; OP = {"QB","RB","WR","TE"}
def optimal(players):
    pool = sorted(players, key=lambda p: -p["pts"]); used=set(); tot=0; picks={}
    def take(slot, allowed):
        nonlocal tot
        for p in pool:
            if p["id"] not in used and p["pos"] in allowed: used.add(p["id"]); tot += p["pts"]; picks[slot]=p; return
    for s,a in [("QB",{"QB"}),("RB1",{"RB"}),("RB2",{"RB"}),("WR1",{"WR"}),("WR2",{"WR"}),("TE",{"TE"}),("OP",OP),("FLEX",FLEX),("K",{"K"})]: take(s,a)
    return round(tot,1), picks
rows=[]; allstarters=[]
for g in B:
    for side, other in (("home","away"),("away","home")):
        s=g[side]; o=g[other]; tid=s["team"]
        starters=[p for p in s["players"] if p["slot"] not in ("BN","IR")]; bench=[p for p in s["players"] if p["slot"]=="BN"]
        opt,picks=optimal(starters+bench)
        top=max(starters,key=lambda p:p["pts"]); low=min(starters,key=lambda p:p["pts"])
        bestbench=max(bench,key=lambda p:p["pts"]) if bench else None
        allstarters += [dict(p, team=tid) for p in starters]
        rows.append({"team":tid,"pts":s["pts"],"opp":o["team"],"oppPts":o["pts"],"win":s["pts"]>o["pts"],"optimal":opt,"left":round(opt-s["pts"],1),
                     "top":top,"low":low,"bestBench":bestbench,"wouldHaveWon": (opt>o["pts"]) and not (s["pts"]>o["pts"]),
                     "starters":sorted(starters,key=lambda p:-p["pts"]),"bench":sorted(bench,key=lambda p:-p["pts"])})
rows.sort(key=lambda r:-r["pts"])
print(f"=== WEEK {wk} ===")
for r in rows:
    t=T[r["team"]]; print(f"\n{t['name']} ({nick(r['team'])}) {'W' if r['win'] else 'L'} {r['pts']} vs {nick(r['opp'])} {r['oppPts']} | optimal {r['optimal']} (left {r['left']} on bench){'  <-- WOULD HAVE WON' if r['wouldHaveWon'] else ''}")
    print("  starters:", ", ".join(f"{p['slot']} {p['name']} {p['pts']}" for p in r["starters"]))
    print("  bench:   ", ", ".join(f"{p['name']} {p['pts']}" for p in r["bench"]))
print("\n=== LEAGUE ===")
print("top starters:", [(p["name"],p["pts"],nick(p["team"])) for p in sorted(allstarters,key=lambda p:-p["pts"])[:8]])
print("worst starters (non-K):", [(p["name"],p["pts"],nick(p["team"])) for p in sorted([p for p in allstarters if p["pos"]!="K"],key=lambda p:p["pts"])[:8]])
print("roster adds since draft:")
for t in L["teams"]:
    adds=[p["name"]+"("+p["pos"]+")" for p in t["roster"] if p["acquired"] and p["acquired"]!="DRAFT"]
    if adds: print(f"  {nick(t['id'])}: {adds}")
print("injuries on rosters:", {nick(t["id"]):[p["name"]+":"+p["injury"] for p in t["roster"] if p["injury"] not in ("ACTIVE",None)] for t in L["teams"]})
