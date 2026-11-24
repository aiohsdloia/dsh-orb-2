import os
import sys

transcript_path = sys.argv[1]
out_dir = sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else "B 站视频"
url = sys.argv[4] if len(sys.argv) > 4 else ""
meta_path = sys.argv[5] if len(sys.argv) > 5 else ""

with open(transcript_path, encoding="utf-8") as handle:
    text = handle.read()

chapters = []
duration = None
if meta_path and os.path.exists(meta_path):
    import json

    with open(meta_path, encoding="utf-8") as handle:
        meta = json.load(handle)
    duration = meta.get("duration_string")
    chapters = meta.get("chapters") or []

replacements = {
    "Depthic": "DeepSeek",
    "Depthick": "DeepSeek",
    "Dipsick": "DeepSeek",
    "Depthick": "DeepSeek",
    "DPC": "DeepSeek",
    "D4": "DeepSeek",
    "Harris": "Harness",
    "Harnies": "Harness",
    "Harleys": "Harness",
    "Harlis": "Harness",
    "AZN": "Agent",
    "圆码": "源码",
    "温斗斯": "Windows",
    "温度用户": "Windows 用户",
    "斗斯": "Windows",
    "麦克": "Mac",
    "差践": "插件",
    "冰块": "积木",
    "魔形": "模型",
    "幕露": "目录",
    "啟动": "启动",
    "抽召系统": "操作系统",
    "作面端": "桌面端",
    "装面端": "桌面端",
    "装面板": "桌面端",
    "外奔": "版本",
    "API-KIA": "API Key",
    "钓用": "调用",
    "边牌": "编排",
    "全线": "权限",
    "会化": "会话",
    "扣端": "客户端",
    "骑出去": "跑出去",
    "齐出去": "跑出去",
    "旗出去": "跑出去",
    "分屁": "分P",
    "极可": "合集",
    "感性地的": "感兴趣的",
    "文党网站": "文档网站",
    "套可以去取品": "大家可以去体验",
    "正号": "账号",
    "帐号": "账号",
    "风死的": "封死的",
    "发怖": "发布",
    "DeepSeek Harleys": "DeepSeek Harness",
    "DeepSeek Harlis": "DeepSeek Harness",
    "DeepSeek Hardness": "DeepSeek Harness",
    "DeepSeek Arleens": "DeepSeek Harness",
    "DeepSeek Arnitz": "DeepSeek Harness",
    "DeepSeek Harlist": "DeepSeek Harness",
    "DeepSeek Harris": "DeepSeek Harness",
    "Dipsychartis": "DeepSeek Harness",
    "DPC Core LIS": "DeepSeek Harness",
    "DPCKharlics": "DeepSeek Harness",
    "DPCKRT": "DeepSeek Harness",
    "DPCK": "DeepSeek",
    "AZN": "Agent",
    "A正": "Agent",
    "全现": "权限",
    "会化": "会话",
    "推华": "对话",
    "榴栏器": "浏览器",
    "目楼": "目录",
    "按鞋杠": "/",
    "按写杠": "/",
    "写杠": "/",
    "夜面上": "页面上",
    "液面上": "页面上",
    "Otto Review": "Auto Review",
    "Programtake Tore Calling": "Programmatic Tool Calling",
    "Domotai": "多模态",
    "被分": "备份",
}
for source, target in replacements.items():
    text = text.replace(source, target)

clean_path = os.path.join(out_dir, "transcript-clean.txt")
with open(clean_path, "w", encoding="utf-8") as handle:
    handle.write(text)

def mmss(value):
    total = int(float(value or 0))
    return f"{total // 60:02d}:{total % 60:02d}"


chapter_text = "\n".join(
    f"- [{mmss(c.get('start_time'))}-{mmss(c.get('end_time'))}] {c.get('title')}"
    for c in chapters
) or "（无章节信息）"

prompt = f"""你是内容编辑。下面是一段 B 站视频的 ASR 转写（可能有错别字，术语已尽量校正）。
视频标题：{title}
视频链接：{url}
视频时长：{duration or "未知"}
章节：
{chapter_text}

请输出一份中文内容速览，必须包含：
1. 一句话结论（这段内容到底讲了什么）
2. 按章节或主题给出 4-8 个关键要点，每条带 [mm:ss] 时间戳
3. 对“个人电脑助手 / DSH 实践”的可用点（3-5 条）
4. 值得回看的片段（时间戳 + 原因）
5. 转写不确定性说明：不要把 ASR 错字当原文引用；不确定的地方标注“不确定”。

不要编造转写中没有的信息。只输出 Markdown。

转写：
{text}
"""

prompt_path = os.path.join(out_dir, "content-prompt.md")
with open(prompt_path, "w", encoding="utf-8") as handle:
    handle.write(prompt)

print(clean_path)
print(prompt_path)
