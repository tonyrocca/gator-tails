# Gator Tails Power Rankings

Live site: https://gator-tails.vercel.app · Repo: https://github.com/tonyrocca/gator-tails

Mobile-first, tap-through power rankings for the Gator Tails ESPN league (id 2016920614). Clean baby-gator look. Same format as the old Word doc: memo bars (Dean of the Year / Dean of the Week), the table (rank + movement, team + owner nickname, record, points), charts, quick hits, one slide per team with Thoughts and a meme, then a shareable PNG of the board.

## Layout
- `data/league_<season>.json` – compact ESPN snapshot (teams, rosters, projections, ADP, draft picks, schedule).
- `data/history.json` – prior-season standings, points, waiver counts (roast material).
- `data/people.json` – one entry per team id: names, nickname, running `notes`. **Add inside jokes here.**
- `data/computed_<season>.json` – output of `scripts/compute.py` (optimal lineups, projections, steals/reaches, model rank + grade).
- `editions/<id>.json` – one edition: `memo` (Dean of the Year text, Dean of the Week text + record), `intro`, `quickHits`, `rankings` (rank, team id, grade, `thoughts`, `meme` {img, top, bottom, caption}), `outro`, `topScorerLabel`. Rank movement is computed automatically against the previous edition file.
- Memes: `meme.img` can be any URL or a file you drop in `site/memes/` (then use `memes/<file>.jpg`). `top`/`bottom` are Impact-style captions drawn over the image; leave them empty if the image already has text. Blank meme templates: https://api.imgflip.com/get_memes
- `scripts/template.html` – the story UI + canvas share card. `scripts/build.py` injects an edition into it.
- `site/` – built output. `site/index.html` = latest edition, `site/<edition-id>/` = archive.

## Producing a new edition
1. Refresh data: log in to ESPN in Chrome, open the league, paste `scripts/fetch_snippet.js` in the console. It copies the JSON to the clipboard. Save it as `data/league_<season>.json`.
   (The league is private; the API needs your ESPN cookies, which is why it runs in the browser.)
2. `python3 scripts/compute.py 2026` – recompute metrics. Prints a summary table + per-team steals/reaches/QBs.
3. Copy the last edition file to `editions/2026-NN-week-N.json` (zero-padded so files sort), set `week`, `title`, `date`, update the `memo` bars, and rewrite `quickHits` and `rankings` (order, `thoughts`, `meme`). Records, points YTD, standings and top scorer come from the data automatically once `week` > 0. Team ids: 1 Tony, 2 Daniel, 3 Ian, 4 Nicky, 5 Nick, 6 Reece, 7 Jackson, 8 Parker, 10 Dean, 11 Ryan.
4. `python3 scripts/build.py editions/<id>.json --site=gator-tails.vercel.app`
5. Commit and push to `main`. Vercel is connected to the GitHub repo and deploys `site/` automatically (root `vercel.json` sets outputDirectory). Share https://gator-tails.vercel.app; the last slide has a Share button that produces a 1080x1920 PNG via the native share sheet (or long-press to save).

Or just tell Claude: "new Gator Tails rankings for week N, here's the context: ..." and it runs the steps above.

## Model
Power score = 0.65·z(optimal starting lineup projection) + 0.20·z(top-5 bench projection) + 0.15·z(draft value vs ESPN ADP, QBs and Ks excluded because public ADP misprices QBs in this superflex 6-pt-TD league). The model is a starting point; the published order is editorial.
