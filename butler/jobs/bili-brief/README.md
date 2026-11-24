# Bilibili Brief (v1)

Discovery-only brief: **follow UP + interest search → filter/dedupe → sourced Markdown**.
No transcripts or ASR in this version.

## Run

```bash
cd butler/jobs/bili-brief

# first time: copy the example config
cp ../../config/interests.example.json ../../config/interests.json
# edit topics / ups / blacklist / limits

node run.mjs --config ../../config/interests.json \
  --out ../../../reports/bili/2026-11-15-brief.md
```

Options:

| Flag | Meaning |
|---|---|
| `--config <path>` | JSON config (default `butler/config/interests.json`) |
| `--out <path>` | Markdown output |
| `--db <path>` | Override control-plane DB |
| `--reset` | Clear `bili_seen` before running |
| `--no-ranking` | Skip the global ranking source |
| `--limit <n>` | Override total items |
| `--cookie <cookie>` | Use a logged-in Bilibili cookie (or `BILI_COOKIE`) |

## Config

```json
{
  "topics": ["人工智能", "大模型"],
  "ups": [{ "name": "影视飓风", "mid": null }],
  "blacklist": ["广告", "搬运"],
  "ranking": { "enabled": false },
  "limits": {
    "perTopic": 8,
    "perUp": 8,
    "ranking": 8,
    "total": 25,
    "minDurationSec": 60,
    "maxDurationSec": 7200,
    "sinceDays": 14,
    "minPlay": 500,
    "minLike": 10
  }
}
```

- `ups` is matched by `mid` when provided, otherwise by author name from search.
- `ranking` is off by default because the global hot list is noisy.
- Exact "following list" sync needs a logged-in cookie and is not implemented in v1.

## Pipeline

`discover → filter → dedupe → brief`

- Discover: generated `buvid3/buvid4` cookie + Bilibili search; optional ranking.
- Filter: date window, duration, blacklist, min play/like.
- Dedupe: `bili_seen` table in the control-plane SQLite DB.
- Brief: Markdown grouped by topic / UP / ranking, with source links and metadata.

## Known limits

- Bilibili search is noisy; tune topics/blacklist/minPlay.
- Ranking (`rid=0`) is global and off by default.
- No transcripts/ASR; deep processing is a later stage.
- API rate limits can return `-352`; the client retries, then records the error.

## Content pass (v1.5, experimental)

For selected videos only:

1. Download audio with yt-dlp + ffmpeg:
   `python -m yt_dlp -f bestaudio --ffmpeg-location <ffmpeg> -o <file>.%(ext)s <url>`
2. Convert to 16 kHz mono WAV:
   `ffmpeg -i <file>.m4a -t 300 -ac 1 -ar 16000 -c:a pcm_s16le <file>.wav`
3. Transcribe with faster-whisper:
   `WHISPER_MODEL=base WHISPER_COMPUTE=float32 python transcribe.py <wav> <transcript.txt>`
4. Build a summary prompt and call DSH headless:
   `python content_prompt.py <transcript.txt> <out_dir> "<title>" "<url>"`
   `dsh headless --json --approval-policy never - < <out_dir>/content-prompt.md`

Notes:
- Pin `ctranslate2==4.5.0`; 4.9.0 crashed with an access violation on this machine.
- VAD is off by default (`WHISPER_VAD=0`) because `onnxruntime` is missing; install it to enable VAD.
- ASR errors are common (e.g. `DeepSeek Harness` → `Depthic Harris`); `content_prompt.py` normalizes common terms and the summary marks uncertainty.
- The first pass uses the first 5 minutes of a long video; extend the WAV duration later.
