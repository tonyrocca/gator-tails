// Paste this into the browser console while logged in at fantasy.espn.com (any page of the league).
// It builds the compact league JSON and copies it to the clipboard. Save as data/league_<season>.json.
(async () => {
  const LEAGUE = 2016920614, SEASON = new Date().getFullYear();
  const u = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/segments/0/leagues/${LEAGUE}?view=mTeam&view=mRoster&view=mSettings&view=mDraftDetail&view=mMatchupScore&view=mStandings`;
  const j = await (await fetch(u, {credentials: 'include'})).json();
  const POS = {1:'QB',2:'RB',3:'WR',4:'TE',5:'K',16:'DST'};
  const PRO = {1:'ATL',2:'BUF',3:'CHI',4:'CIN',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GB',10:'TEN',11:'IND',12:'KC',13:'LV',14:'LAR',15:'MIA',16:'MIN',17:'NE',18:'NO',19:'NYG',20:'NYJ',21:'PHI',22:'ARI',23:'PIT',24:'LAC',25:'SF',26:'SEA',27:'TB',28:'WSH',29:'CAR',30:'JAX',33:'BAL',34:'HOU'};
  const stat = (p, yr, src) => { const s = (p.stats || []).find(x => x.seasonId === yr && x.statSourceId === src && x.statSplitTypeId === 0); return s ? +s.appliedTotal.toFixed(1) : null; };
  const teams = j.teams.map(t => ({id: t.id, name: t.name.trim(), abbrev: t.abbrev, logo: t.logo, owner: t.owners[0],
    record: t.record && {w: t.record.overall.wins, l: t.record.overall.losses, pf: +t.record.overall.pointsFor.toFixed(1), pa: +t.record.overall.pointsAgainst.toFixed(1)},
    trans: t.transactionCounter && {acq: t.transactionCounter.acquisitions, drops: t.transactionCounter.drops, trades: t.transactionCounter.trades},
    roster: (t.roster?.entries || []).map(e => { const p = e.playerPoolEntry.player; return {id: p.id, name: p.fullName, pos: POS[p.defaultPositionId] || p.defaultPositionId, team: PRO[p.proTeamId] || p.proTeamId, slot: e.lineupSlotId, proj: stat(p, SEASON, 1), last: stat(p, SEASON - 1, 0), season: stat(p, SEASON, 0), adp: p.ownership ? +p.ownership.averageDraftPosition.toFixed(1) : null, injury: p.injuryStatus, rank: p.draftRanksByRankType?.PPR?.rank}; })}));
  const picks = (j.draftDetail?.picks || []).map(p => ({r: p.roundId, pk: p.roundPickNumber, ov: p.overallPickNumber, team: p.teamId, player: p.playerId}));
  const schedule = (j.schedule || []).map(m => ({wk: m.matchupPeriodId, home: m.home?.teamId, away: m.away?.teamId, hs: m.home?.totalPoints, as: m.away?.totalPoints, winner: m.winner}));
  const s = j.settings;
  const out = {name: s.name, size: s.size, season: SEASON, members: j.members.map(m => ({id: m.id, name: m.firstName + ' ' + m.lastName, dn: m.displayName})),
    roster: s.rosterSettings.lineupSlotCounts, scoring: s.scoringSettings.scoringItems.filter(x => x.points).map(x => [x.statId, x.points]),
    sched: {weeks: s.scheduleSettings?.matchupPeriodCount, playoffTeams: s.scheduleSettings?.playoffTeamCount}, currentWeek: j.scoringPeriodId,
    draftOrder: s.draftSettings.pickOrder, draftDate: s.draftSettings.date, teams, picks, schedule};
  const str = JSON.stringify(out);
  try { await navigator.clipboard.writeText(str); console.log('copied to clipboard:', str.length, 'chars'); }
  catch (e) { console.log('clipboard blocked; copy the string below'); console.log(str); }
  window.__league = out;
})();
