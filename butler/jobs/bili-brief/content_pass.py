import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "butler" / "data" / "bili"
AUDIO = DATA / "audio"
TRANSCRIPTS = DATA / "transcripts"
MODELS = DATA / "models"
AUTH = Path(os.environ.get("APPDATA", "")) / "com.sculab.openlab" / "runtime" / "xdg-data" / "opencode" / "auth.json"
CONTENT_PROMPT = Path(__file__).with_name("content_prompt.py")


def run(cmd, timeout=600, **kwargs):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=timeout, **kwargs)


def ffmpeg_path():
    return imageio_ffmpeg.get_ffmpeg_exe()


def deepseek_key():
    if os.environ.get("DEEPSEEK_API_KEY"):
        return os.environ["DEEPSEEK_API_KEY"]
    data = json.loads(AUTH.read_text(encoding="utf-8"))
    key = (data.get("deepseek") or {}).get("key")
    if not key:
        raise RuntimeError("DEEPSEEK_API_KEY is unavailable")
    return key


def download_audio(item, timeout=300):
    bvid = item["bvid"]
    url = item["url"]
    if "p=" not in url:
        url = f"{url}?p={item.get('part', 1)}"
    AUDIO.mkdir(parents=True, exist_ok=True)
    template = str(AUDIO / bvid) + ".%(ext)s"
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-warnings", "--no-playlist",
        "-f", "bestaudio",
        "--write-info-json",
        "--add-header", "Referer:https://www.bilibili.com/",
        "--retries", "10",
        "--fragment-retries", "10",
        "--socket-timeout", "30",
        "--ffmpeg-location", ffmpeg_path(),
        "-o", template,
        url,
    ]
    try:
        run(cmd, timeout=timeout)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"yt-dlp failed: {error.stderr[-500:]}") from error
    candidates = [
        p for p in AUDIO.glob(bvid + ".*")
        if not p.name.endswith(".info.json")
        and not p.name.endswith(".part")
        and not p.name.endswith(".ytdl")
    ]
    if not candidates:
        raise RuntimeError(f"audio not found for {bvid}")
    audio = candidates[0]
    meta_path = AUDIO / (bvid + ".info.json")
    return audio, meta_path


def transcribe(audio, bvid, minutes, model):
    TRANSCRIPTS.mkdir(parents=True, exist_ok=True)
    wav = AUDIO / f"{bvid}-{minutes}m.wav"
    run([
        ffmpeg_path(), "-y", "-i", str(audio),
        "-t", str(minutes * 60),
        "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
        str(wav),
    ], timeout=300)

    segments, _ = model.transcribe(
        str(wav),
        language="zh",
        vad_filter=False,
        beam_size=1,
        condition_on_previous_text=False,
    )
    lines = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            lines.append(f"[{segment.start:7.2f}-{segment.end:7.2f}] {text}")
    transcript = TRANSCRIPTS / f"{bvid}-{minutes}m.txt"
    transcript.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return transcript, len(lines)


def summarize(item, transcript, meta_path, work_dir, model_label, minutes):
    work_dir.mkdir(parents=True, exist_ok=True)
    run([
        sys.executable, str(CONTENT_PROMPT),
        str(transcript), str(work_dir),
        item.get("title", item["bvid"]), item["url"],
        str(meta_path) if meta_path and meta_path.exists() else "",
    ], timeout=120)
    prompt = (work_dir / "content-prompt.md").read_text(encoding="utf-8")

    node = shutil.which("node")
    dsh_js = Path(os.environ.get("APPDATA", "")) / "npm" / "node_modules" / "@deepseek-ai" / "dsh" / "lib" / "bin.js"
    if not node or not dsh_js.exists():
        raise RuntimeError("node or global @deepseek-ai/dsh not found")

    env = os.environ.copy()
    env["DEEPSEEK_API_KEY"] = deepseek_key()
    result = subprocess.run(
        [node, str(dsh_js), "headless", "--json", "--approval-policy", "never", "-"],
        input=prompt.encode("utf-8"),
        capture_output=True,
        timeout=900,
        env=env,
    )
    if result.returncode != 0:
        raise RuntimeError(f"dsh exited {result.returncode}: {result.stderr[-400:]}")
    final = None
    for line in result.stdout.decode("utf-8", "replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except Exception:
            continue
        if event.get("type") == "final":
            final = event
    text = (final or {}).get("text")
    if not text:
        raise RuntimeError("dsh returned no final text")

    duration = ""
    if meta_path and meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            duration = meta.get("duration_string") or ""
        except Exception:
            pass

    header = (
        f"# 内容速览：{item.get('title', item['bvid'])}\n\n"
        f"- 视频：{item['url']}\n"
        f"- 处理范围：前 {minutes} 分钟" + (f"（视频时长 {duration}）" if duration else "") + "\n"
        f"- ASR：faster-whisper {model_label} / CPU；术语已归一化，仍可能有错字。\n\n"
    )
    return header + text + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--items", required=True, help="JSON list of {bvid,title,url,part}")
    parser.add_argument("--out-dir", default=str(ROOT / "reports" / "bili" / "content"))
    parser.add_argument("--max-minutes", type=int, default=5)
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "base"))
    args = parser.parse_args()

    items = json.loads(Path(args.items).read_text(encoding="utf-8"))
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {}
    errors = []

    os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
    whisper = WhisperModel(
        args.model,
        device="cpu",
        compute_type=os.environ.get("WHISPER_COMPUTE", "float32"),
        download_root=str(MODELS),
    )

    for item in items:
        bvid = item["bvid"]
        cached = out_dir / f"{bvid}.md"
        if cached.exists():
            manifest[bvid] = cached.resolve().relative_to(ROOT).as_posix()
            print(f"[cache] {bvid}", flush=True)
            continue
        try:
            print(f"[download] {bvid}", flush=True)
            audio, meta_path = download_audio(item)
            print(f"[transcribe] {bvid}", flush=True)
            transcript, count = transcribe(audio, bvid, args.max_minutes, whisper)
            print(f"[summary] {bvid} segments={count}", flush=True)
            text = summarize(item, transcript, meta_path, DATA / "content-work" / bvid, args.model, args.max_minutes)
            cached.write_text(text, encoding="utf-8")
            manifest[bvid] = cached.resolve().relative_to(ROOT).as_posix()
            print(f"[done] {bvid} -> {cached}", flush=True)
        except Exception as error:
            errors.append({"bvid": bvid, "error": str(error)})
            manifest[bvid] = None
            print(f"[error] {bvid}: {error}", flush=True)

    (out_dir / "manifest.json").write_text(
        json.dumps({"items": manifest, "errors": errors}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps({"manifest": manifest, "errors": errors}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
