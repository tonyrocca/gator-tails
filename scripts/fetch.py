#!/usr/bin/env python3
"""Fetch the Gator Tails league from ESPN (league is public) into data/league_<season>.json
plus raw box scores into data/raw_<season>.json. Usage: fetch.py [season]"""
import json, sys, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
LEAGUE = 2016920614
season = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
POS = {1:'QB',2:'RB',3:'WR',4:'TE',5:'K',16:'DST'}
PRO = {0:'FA',1:'ATL',2:'BUF',3:'CHI',4:'CIN',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GB',10:'TEN',11:'IND',12:'KC',13:'LV',14:'LAR',15:'MIA',16:'MIN',17:'NE',18:'NO',19:'NYG',20:'NYJ',21:'PHI',22:'ARI',23:'PIT',24:'LAC',25:'SF',26:'SEA',27:'TB',28:'WSH',29:'CAR',30:'JAX',33:'BAL',34:'HOU'}
SLOT = {0:'QB',2:'RB',4:'WR',6:'TE',7:'OP',16:'DST',17:'K',20:'BN',21:'IR',23:'FLEX'}
def get(url, headers=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', **(headers or {})})
    return json.load(urllib.request.urlopen(req, timeout=60))
base = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/{LEAGUE}"
j = get(base + "?view=mTeam&view=mRoster&view=mSettings&view=mDraftDetail&view=mMatchupScore&view=mStandings")
cur = j["scoringPeriodId"]
def stat(p, yr, src, split=0, period=None):
    for s in p.get("stats", []):
        if s["seasonId"] == yr and s["statSourceId"] == src and s["statSplitTypeId"] == split and (period is None or s["scoringPeriodId"] == period):
            return round(s.get("appliedTotal", 0), 1)
    return None
teams = []
for t in j["teams"]:
    r = t.get("record", {}).get("overall", {})
    teams.append({"id": t["id"], "name": t["name"].strip(), "abbrev": t["abbrev"], "logo": t.get("logo"), "owner": (t.get("owners") or [None])[0],
        "record": {"w": r.get("wins", 0), "l": r.get("losses", 0), "t": r.get("ties", 0), "pf": round(r.get("pointsFor", 0), 2), "pa": round(r.get("pointsAgainst", 0), 2), "streak": f"{r.get('streakType','')[:1]}{r.get('streakLength',0)}"},
        "playoffSeed": t.get("playoffSeed"), "trans": {k: t.get("transactionCounter", {}).get(k, 0) for k in ("acquisitions", "drops", "trades", "moveToActive")},
        "roster": [{"id": p["playerPoolEntry"]["player"]["id"], "name": p["playerPoolEntry"]["player"]["fullName"], "pos": POS.get(p["playerPoolEntry"]["player"]["defaultPositionId"], "?"),
                    "team": PRO.get(p["playerPoolEntry"]["player"]["proTeamId"], "?"), "slot": p["lineupSlotId"], "slotName": SLOT.get(p["lineupSlotId"], str(p["lineupSlotId"])),
                    "proj": stat(p["playerPoolEntry"]["player"], season, 1), "last": stat(p["playerPoolEntry"]["player"], season - 1, 0), "season": stat(p["playerPoolEntry"]["player"], season, 0),
                    "adp": round(p["playerPoolEntry"]["player"].get("ownership", {}).get("averageDraftPosition", 0), 1) or None,
                    "injury": p["playerPoolEntry"]["player"].get("injuryStatus"), "acquired": p.get("acquisitionType"), "acquiredDate": p.get("acquisitionDate")}
                   for p in t.get("roster", {}).get("entries", [])]})
picks = [{"r": p["roundId"], "pk": p["roundPickNumber"], "ov": p["overallPickNumber"], "team": p["teamId"], "player": p["playerId"], "auto": p.get("autoDraftTypeId", 0)} for p in j.get("draftDetail", {}).get("picks", [])]
schedule = [{"wk": m["matchupPeriodId"], "home": m.get("home", {}).get("teamId"), "away": m.get("away", {}).get("teamId"), "hs": m.get("home", {}).get("totalPoints"), "as": m.get("away", {}).get("totalPoints"), "winner": m.get("winner")} for m in j.get("schedule", [])]
s = j["settings"]
out = {"name": s["name"], "size": s["size"], "season": season, "currentWeek": cur, "fetched": __import__("datetime").datetime.now().isoformat(timespec="minutes"),
       "members": [{"id": m["id"], "name": f"{m.get('firstName','')} {m.get('lastName','')}".strip(), "dn": m.get("displayName")} for m in j["members"]],
       "roster": s["rosterSettings"]["lineupSlotCounts"], "scoring": [[x["statId"], x["points"]] for x in s["scoringSettings"]["scoringItems"] if x.get("points")],
       "sched": {"weeks": s["scheduleSettings"].get("matchupPeriodCount"), "playoffTeams": s["scheduleSettings"].get("playoffTeamCount")},
       "draftOrder": s["draftSettings"]["pickOrder"], "draftDate": s["draftSettings"].get("date"), "teams": teams, "picks": picks, "schedule": schedule}
# box scores per completed week (lineups + player points)
box = {}
for wk in range(1, cur + 1):
    b = get(base + f"?view=mBoxscore&view=mMatchupScore&scoringPeriodId={wk}")
    games = []
    for m in b.get("schedule", []):
        if m["matchupPeriodId"] != wk: continue
        g = {"wk": wk}
        for side in ("home", "away"):
            sd = m.get(side, {}); g[side] = {"team": sd.get("teamId"), "pts": sd.get("totalPoints"), "players": []}
            for e in sd.get("rosterForCurrentScoringPeriod", {}).get("entries", []):
                p = e["playerPoolEntry"]["player"]
                g[side]["players"].append({"id": p["id"], "name": p["fullName"], "pos": POS.get(p["defaultPositionId"], "?"), "slot": SLOT.get(e["lineupSlotId"], str(e["lineupSlotId"])),
                                           "pts": round(e["playerPoolEntry"].get("appliedStatTotal", 0), 1), "proj": stat(p, season, 1, 1, wk)})
        games.append(g)
    box[wk] = games
json.dump(out, open(ROOT / f"data/league_{season}.json", "w"), indent=1)
json.dump(box, open(ROOT / f"data/box_{season}.json", "w"), indent=1)
print("season", season, "currentWeek", cur, "| teams", len(teams), "| picks", len(picks), "| box weeks", list(box))
for t in sorted(teams, key=lambda t: (-t["record"]["w"], -t["record"]["pf"])):
    print(f"  {t['name'][:26]:26} {t['record']['w']}-{t['record']['l']}  PF {t['record']['pf']:7.2f}  PA {t['record']['pa']:7.2f}  moves {t['trans']['acquisitions']}")
