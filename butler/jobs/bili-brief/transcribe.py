import os
import sys

from faster_whisper import WhisperModel

wav = sys.argv[1]
out = sys.argv[2]
model_name = os.environ.get("WHISPER_MODEL", "base")
model_root = os.environ.get(
    "WHISPER_MODEL_ROOT",
    os.path.join(os.path.dirname(out), "..", "models"),
)

model = WhisperModel(
    model_name,
    device="cpu",
    compute_type=os.environ.get("WHISPER_COMPUTE", "int8"),
    download_root=os.path.abspath(model_root),
)
segments, info = model.transcribe(
    wav,
    language="zh",
    vad_filter=os.environ.get("WHISPER_VAD", "0") == "1",
    beam_size=1,
    condition_on_previous_text=False,
)

lines = []
for segment in segments:
    text = segment.text.strip()
    if not text:
        continue
    line = f"[{segment.start:7.2f}-{segment.end:7.2f}] {text}"
    lines.append(line)
    print(line, flush=True)

os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as handle:
    handle.write("\n".join(lines) + "\n")
print(f"wrote {out} segments={len(lines)}", file=sys.stderr)
