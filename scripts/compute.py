#!/usr/bin/env python3
"""Compute draft / roster metrics for every team from data/league_<season>.json.
Writes data/computed_<season>.json. Pure stats; the humor lives in editions/."""
import json, sys, statistics as st
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
season = sys.argv[1] if len(sys.argv) > 1 else "2026"
L = json.load(open(ROOT / f"data/league_{season}.json"))
people = json.load(open(ROOT / "data/people.json"))
hist = json.load(open(ROOT / "data/history.json"))

FLEX = {"RB", "WR", "TE"}
OP = {"QB", "RB", "WR", "TE"}

def optimal_lineup(roster):
    """QB, 2RB, 2WR, TE, FLEX, OP, K greedy with both FLEX/OP orderings."""
    def run(order):
        pool = sorted([p for p in roster if p["proj"] is not None], key=lambda p: -p["proj"])
        used, out = set(), {}
        def take(slot, allowed):
            for p in pool:
                if p["id"] not in used and p["pos"] in allowed:
                    used.add(p["id"]); out[slot] = p; return
        take("QB", {"QB"}); take("RB1", {"RB"}); take("RB2", {"RB"})
        take("WR1", {"WR"}); take("WR2", {"WR"}); take("TE", {"TE"})
        for s in order:
            take(s, FLEX if s == "FLEX" else OP)
        take("K", {"K"})
        bench = [p for p in pool if p["id"] not in used]
        return out, bench
    a = run(["OP", "FLEX"]); b = run(["FLEX", "OP"])
    return max([a, b], key=lambda r: sum(p["proj"] for p in r[0].values()))

pick_by_player = {p["player"]: p for p in L["picks"]}
teams = []
for t in L["teams"]:
    r = t["roster"]
    for p in r:
        pk = pick_by_player.get(p["id"])
        p["pick"] = pk["ov"] if pk else None
        p["round"] = pk["r"] if pk else None
        p["value"] = round(p["pick"] - p["adp"], 1) if (pk and p["adp"]) else None  # + = taken later than ADP = steal
    starters, bench = optimal_lineup(r)
    start_pts = round(sum(p["proj"] for p in starters.values()), 1)
    bench_pts = round(sum(sorted([p["proj"] for p in bench if p["pos"] != "K"], reverse=True)[:5]), 1)
    drafted = [p for p in r if p["pick"] and p["round"] <= 12 and p["value"] is not None and p["pos"] not in ("QB", "K")]  # public ADP misprices QBs in superflex
    value_total = round(sum(p["value"] for p in drafted), 1)
    steals = sorted([p for p in r if p["value"] is not None and p["pos"] != "QB"], key=lambda p: -p["value"])[:3]
    reaches = sorted([p for p in r if p["value"] is not None and p["pos"] != "QB"], key=lambda p: p["value"])[:3]
    pos = {}
    for p in r: pos[p["pos"]] = pos.get(p["pos"], 0) + 1
    hurt = [p["name"] for p in r if p["injury"] not in ("ACTIVE", None)]
    rookies = [p["name"] for p in r if p["last"] is None]
    qbs = sorted([p for p in r if p["pos"] == "QB"], key=lambda p: -p["proj"])
    last_total = round(sum((p["last"] or 0) for p in starters.values()), 1)
    slot_pts = {s: {"name": p["name"], "pos": p["pos"], "proj": p["proj"]} for s, p in starters.items()}
    h25 = next((x for x in hist["2025"]["teams"] if x["id"] == t["id"]), None)
    h24 = next((x for x in hist["2024"]["teams"] if x["id"] == t["id"]), None)
    slot = L["draftOrder"].index(t["id"]) + 1
    rec = t.get("record") or {"w": 0, "l": 0, "pf": 0.0, "pa": 0.0}
    weekly = []
    for m in sorted(L.get("schedule", []), key=lambda m: m["wk"]):
        if m.get("home") == t["id"] and m.get("hs") is not None and (m.get("hs") or m.get("as")):
            weekly.append({"wk": m["wk"], "pts": m["hs"], "opp": m["away"], "oppPts": m["as"], "win": m["hs"] > m["as"]})
        elif m.get("away") == t["id"] and m.get("as") is not None and (m.get("hs") or m.get("as")):
            weekly.append({"wk": m["wk"], "pts": m["as"], "opp": m["home"], "oppPts": m["hs"], "win": m["as"] > m["hs"]})
    teams.append({
        "id": t["id"], "name": t["name"], "abbrev": t["abbrev"], "logo": t["logo"],
        "manager": people[str(t["id"])], "draftSlot": slot,
        "record": {"w": rec["w"], "l": rec["l"], "pf": round(rec.get("pf") or sum(w["pts"] for w in weekly), 2), "pa": round(rec.get("pa") or sum(w["oppPts"] for w in weekly), 2)},
        "weekly": weekly, "trans": t.get("trans"),
        "startPts": start_pts, "benchPts": bench_pts, "lastYearStarterPts": last_total,
        "valueTotal": value_total, "starters": slot_pts,
        "steals": [{"name": p["name"], "pos": p["pos"], "pick": p["pick"], "round": p["round"], "adp": p["adp"], "value": p["value"], "proj": p["proj"]} for p in steals],
        "reaches": [{"name": p["name"], "pos": p["pos"], "pick": p["pick"], "round": p["round"], "adp": p["adp"], "value": p["value"], "proj": p["proj"]} for p in reaches],
        "posCounts": pos, "questionable": hurt, "rookies": rookies,
        "qbs": [{"name": p["name"], "proj": p["proj"], "last": p["last"], "round": p["round"]} for p in qbs],
        "firstPick": next(({"name": p["name"], "pos": p["pos"], "pick": p["pick"]} for p in r if p["round"] == 1), None),
        "kickerRound": next((p["round"] for p in r if p["pos"] == "K"), None),
        "history": {"2025": h25, "2024": h24},
        "roster": [{"name": p["name"], "pos": p["pos"], "team": p["team"], "proj": p["proj"], "last": p["last"], "adp": p["adp"], "pick": p["pick"], "round": p["round"], "value": p["value"], "injury": p["injury"], "starter": p["id"] in {s["id"] for s in starters.values()}} for p in sorted(r, key=lambda p: p["pick"] or 999)],
    })

def z(vals):
    m, s = st.mean(vals), st.pstdev(vals) or 1
    return [(v - m) / s for v in vals]
zs = z([t["startPts"] for t in teams]); zb = z([t["benchPts"] for t in teams]); zv = z([t["valueTotal"] for t in teams])
for t, a, b, c in zip(teams, zs, zb, zv):
    t["score"] = round(0.65 * a + 0.2 * b + 0.15 * c, 3)
teams.sort(key=lambda t: -t["score"])
for i, t in enumerate(teams): t["modelRank"] = i + 1
def grade(sc):
    for cut, g in [(1.0, "A+"), (0.6, "A"), (0.3, "A-"), (0.1, "B+"), (-0.1, "B"), (-0.35, "B-"), (-0.6, "C+"), (-0.9, "C"), (-1.3, "C-")]:
        if sc >= cut: return g
    return "D"
for t in teams: t["modelGrade"] = grade(t["score"])

# league-wide fun facts
allp = [dict(p, teamId=t["id"], teamName=t["name"]) for t in L["teams"] for p in t["roster"]]
drafted = [p for p in allp if p["value"] is not None and p["pos"] != "QB"]
qbdrafted = [p for p in allp if p["value"] is not None and p["pos"] == "QB"]
league = {
    "biggestSteals": sorted(drafted, key=lambda p: -p["value"])[:8],
    "biggestReaches": sorted(drafted, key=lambda p: p["value"])[:8],
    "qbReaches": sorted(qbdrafted, key=lambda p: p["value"])[:5],
    "qbSteals": sorted(qbdrafted, key=lambda p: -p["value"])[:5],
    "firstQB": min([p for p in allp if p["pos"] == "QB"], key=lambda p: p["pick"]),
    "firstK": min([p for p in allp if p["pos"] == "K"], key=lambda p: p["pick"]),
    "firstTE": min([p for p in allp if p["pos"] == "TE"], key=lambda p: p["pick"]),
    "qbCounts": {t["id"]: t["posCounts"].get("QB", 0) for t in teams},
    "kCounts": {t["id"]: t["posCounts"].get("K", 0) for t in teams},
    "rookieCounts": {t["id"]: len(t["rookies"]) for t in teams},
    "hurtCounts": {t["id"]: len(t["questionable"]) for t in teams},
    "topProjPlayers": sorted(allp, key=lambda p: -(p["proj"] or 0))[:10],
    "lastYearTop": sorted(allp, key=lambda p: -(p["last"] or 0))[:10],
    "avgStart": round(st.mean(t["startPts"] for t in teams), 1),
    "currentWeek": L.get("currentWeek"),
    "weeksPlayed": max([w["wk"] for t in teams for w in t["weekly"]] or [0]),
}
for k in ("biggestSteals", "biggestReaches", "topProjPlayers", "lastYearTop", "qbReaches", "qbSteals"):
    league[k] = [{"name": p["name"], "pos": p["pos"], "pick": p["pick"], "round": p["round"], "adp": p["adp"], "value": p["value"], "proj": p["proj"], "last": p["last"], "teamId": p["teamId"], "teamName": p["teamName"]} for p in league[k]]
for k in ("firstQB", "firstK", "firstTE"):
    p = league[k]; league[k] = {"name": p["name"], "pick": p["pick"], "round": p["round"], "teamId": p["teamId"], "teamName": p["teamName"]}

# standings order: wins, then points for
standings = sorted(teams, key=lambda t: (-t["record"]["w"], -t["record"]["pf"]))
for i, t in enumerate(standings): t["standing"] = i + 1
wp = league["weeksPlayed"]
if wp:
    last = [(t["id"], next((w["pts"] for w in t["weekly"] if w["wk"] == wp), 0)) for t in teams]
    league["topScorerLastWeek"] = max(last, key=lambda x: x[1])
    league["lowScorerLastWeek"] = min(last, key=lambda x: x[1])
    league["topScorerSeason"] = max(teams, key=lambda t: t["record"]["pf"])["id"]
out = {"season": season, "league": L["name"], "teams": teams, "leagueFacts": league, "schedule": L["schedule"]}
json.dump(out, open(ROOT / f"data/computed_{season}.json", "w"), indent=1)
print(f"{'#':>2} {'team':28} {'mgr':8} {'slot':>4} {'start':>6} {'bench':>6} {'val':>6} {'score':>6} gr  QBs K rk hurt")
for t in teams:
    print(f"{t['modelRank']:>2} {t['name'][:28]:28} {t['manager']['first']:8} {t['draftSlot']:>4} {t['startPts']:>6} {t['benchPts']:>6} {t['valueTotal']:>6} {t['score']:>6} {t['modelGrade']:3} {t['posCounts'].get('QB',0)}   {t['posCounts'].get('K',0)} {len(t['rookies'])}  {len(t['questionable'])}")
print("\nSteals:", [(p['name'], p['teamName'], p['round'], p['value']) for p in league['biggestSteals']])
print("\nReaches:", [(p['name'], p['teamName'], p['round'], p['value']) for p in league['biggestReaches']])
print("firstQB", league['firstQB'], "\nfirstK", league['firstK'], "\nfirstTE", league['firstTE'])
for t in teams:
    print(f"\n{t['name']} ({t['manager']['first']}): " + ", ".join(f"{s}:{v['name']}({v['proj']})" for s, v in t['starters'].items()))
    print("  steals:", [(p['name'], p['round'], p['value']) for p in t['steals']], " reaches:", [(p['name'], p['round'], p['value']) for p in t['reaches']])
    print("  QBs:", [(q['name'], q['round'], q['last']) for q in t['qbs']], " K rd:", t['kickerRound'], " rookies:", t['rookies'], " hurt:", t['questionable'])
