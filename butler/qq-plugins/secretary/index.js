import fs from 'node:fs'
import path from 'node:path'

const NOTE_EXT = '.md'

function pad(n) { return String(n).padStart(2, '0') }
function todayStamp() {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
function nowHHMM() {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export default {
  id: 'secretary',
  title: '秘书（随手记/日程）',
  order: 65,
  configSchema: {
    enabled: { type: 'bool', default: true, group: '秘书', label: '启用秘书命令' },
    notesDir: { type: 'str', default: '', group: '秘书', label: '笔记目录（留空=数据目录/secretary/notes）' },
    scheduleFile: { type: 'str', default: '', group: '秘书', label: '日程文件（留空=数据目录/secretary/schedule.md）' },
  },
  setup(bot) {
    const cfg = bot.cfg || {}
    if (cfg.enabled === false) return
    const dataDir = String(bot.core?.dataDir || '.')
    const notesDir = () => String(cfg.notesDir || '').trim() || path.join(dataDir, 'secretary', 'notes')
    const scheduleFile = () => String(cfg.scheduleFile || '').trim() || path.join(dataDir, 'secretary', 'schedule.md')

    const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) }
    const appendLine = (f, line) => { ensureDir(path.dirname(f)); fs.appendFileSync(f, `${line}\n`, 'utf8') }
    const readLines = (f) => {
      try { return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean) } catch { return [] }
    }

    async function reply(ev, text) {
      await bot.deliver(ev.chatKey, text)
      ev.stopped = true
      ev.stopReason = 'secretary'
    }

    bot.registerCommand('记', {
      permission: 'master',
      description: '记一条笔记：/记 内容',
      async handler(ev, args) {
        const text = (args || []).join(' ').trim()
        if (!text) return reply(ev, '用法：/记 要记的内容')
        const f = path.join(notesDir(), `${todayStamp()}${NOTE_EXT}`)
        appendLine(f, `- ${nowHHMM()} ${text}`)
        return reply(ev, `已记下（${todayStamp()}）：${text}`)
      },
    })

    bot.registerCommand('查', {
      permission: 'master',
      description: '查笔记：/查 关键词',
      async handler(ev, args) {
        const kw = (args || []).join(' ').trim().toLowerCase()
        if (!kw) return reply(ev, '用法：/查 关键词')
        ensureDir(notesDir())
        const hits = []
        for (const name of fs.readdirSync(notesDir()).sort().reverse()) {
          if (!name.endsWith(NOTE_EXT)) continue
          const day = name.slice(0, -NOTE_EXT.length)
          for (const line of readLines(path.join(notesDir(), name))) {
            if (line.toLowerCase().includes(kw)) hits.push(`[${day}] ${line}`)
          }
        }
        const out = hits.slice(-8).join('\n')
        return reply(ev, out || `没有找到和「${kw}」相关的笔记`)
      },
    })

    bot.registerCommand('日程', {
      permission: 'master',
      description: '排日程：/日程 MM-DD HH:mm 事项；或 /日程 查看待办',
      async handler(ev, args) {
        const text = (args || []).join(' ').trim()
        if (!text) {
          const pending = readLines(scheduleFile()).filter((l) => /pending$/.test(l.trim()))
          if (!pending.length) return reply(ev, '日程是空的。用法：/日程 11-25 20:00 交报告')
          return reply(ev, '待办日程：\n' + pending.join('\n'))
        }
        const m = text.match(/^(\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+(.+)$/)
        if (!m) return reply(ev, '格式：/日程 MM-DD HH:mm 事项（例：/日程 11-25 20:00 交报告）')
        appendLine(scheduleFile(), `${m[1]} ${m[2]} | ${m[3]} | pending`)
        return reply(ev, `已排入日程：${m[1]} ${m[2]} · ${m[3]}`)
      },
    })

    bot.registerCommand('日程完', {
      permission: 'master',
      description: '完成日程：/日程完 关键词',
      async handler(ev, args) {
        const kw = (args || []).join(' ').trim()
        if (!kw) return reply(ev, '用法：/日程完 关键词（标记匹配的待办为完成）')
        const f = scheduleFile()
        const lines = readLines(f)
        let n = 0
        const next = lines.map((l) => {
          if (l.includes(kw) && /pending$/.test(l.trim())) { n++; return l.replace(/pending$/, 'done') }
          return l
        })
        if (!n) return reply(ev, `没有匹配「${kw}」的待办`)
        fs.writeFileSync(f, next.join('\n') + '\n', 'utf8')
        return reply(ev, `已完成 ${n} 项（${kw}）`)
      },
    })
  },
}
