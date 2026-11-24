# Weekly Digest (v1)

Wraps the latest Bilibili brief into a Steward weekly report. Optionally generates a fresh brief and runs the content pass for the top N videos.

## Run

```bash
# reuse an existing brief (fast, no network)
node run.mjs --brief ../../reports/bili/2026-11-15-brief.md

# generate a fresh brief + content pass for the first video
node run.mjs --config ../../config/interests.json --content-top 1

# skip generation and use the newest *-brief.md
node run.mjs --no-generate
```

Output: `reports/weekly/<ISO-week>.md`

## Schedule

Dry run (prints the `schtasks` command only):

```powershell
powershell -File register-task.ps1 -Day MON -Time 09:00
```

Register after review:

```powershell
powershell -File register-task.ps1 -Day MON -Time 09:00 -Register
```

The task runs `run-weekly.ps1`, which calls:

```powershell
node butler/jobs/weekly/run.mjs --config butler/config/interests.json --content-top 1
```

## Notes

- Dedupe means a weekly run only includes new videos; use `--brief` for a test with an existing file.
- `--content-top 1` uses the content cache (`reports/bili/content/<bvid>.md`) and only runs ASR on a cache miss.
- ASR needs `ctranslate2==4.5.0`; see `../bili-brief/README.md`.
- The scheduled task runs only when the user is logged in (default Windows Task Scheduler behavior).
