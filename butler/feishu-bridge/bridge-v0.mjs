// Feishu -> dsh bridge, v0.
// On a Feishu message: run `dsh --profile headless "<text>"` once and send the
// agent's answer back to the chat. No session continuity yet; this is the
// fastest end-to-end proof that the agent answers through Feishu.
//
// Self-test the dsh call without Feishu:
//   node bridge-v0.mjs --selftest

import * as Lark from '@larksuiteoapi/node-sdk'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const DSH_REPO = process.env.DSH_REPO
  ?? 'C:\\Users\\10840\\Documents\\OpenLab\\projects\\dsh-orb-2\\upstream\\deepseek-harness-orb'
const DSH_TIMEOUT_MS = Number(process.env.DSH_TIMEOUT_MS ?? 300000)
const ALLOWED_OPEN_ID = process.env.FEISHU_ALLOWED_OPEN_ID ?? ''

async function askDsh(text) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', '--profile', 'headless', text],
    { cwd: DSH_REPO, env: process.env, maxBuffer: 16 * 1024 * 1024, timeout: DSH_TIMEOUT_MS },
  )
  return stdout.trim()
}

async function main() {
  if (process.argv.includes('--selftest')) {
    const reply = await askDsh('Reply with exactly SELFTEST-OK and nothing else. Do not call tools.')
    console.log('SELFTEST REPLY >>>' + reply + '<<<')
    return
  }

  const appId = process.env.FEISHU_APP_ID
  const appSecret = process.env.FEISHU_APP_SECRET
  if (!appId || !appSecret) {
    console.error('missing FEISHU_APP_ID / FEISHU_APP_SECRET')
    process.exit(1)
  }

  const client = new Lark.Client({ appId, appSecret })
  const wsClient = new Lark.WSClient({ appId, appSecret, loggerLevel: Lark.LoggerLevel.info })

  async function sendText(chatId, text) {
    await client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text }) },
    })
  }

  const dispatcher = new Lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      const message = data.message
      const chatId = message.chat_id
      const openId = data.sender?.sender_id?.open_id
      let text = ''
      try { text = JSON.parse(message.content ?? '{}').text ?? '' } catch { /* non-text */ }
      console.log(`[recv] chat=${chatId} from=${openId} text=${JSON.stringify(text)}`)

      if (ALLOWED_OPEN_ID && openId !== ALLOWED_OPEN_ID) {
        console.log('[skip] sender not allowed')
        return
      }
      if (message.message_type !== 'text' || text.trim() === '') {
        await sendText(chatId, '（目前只认文字消息）')
        return
      }

      const started = Date.now()
      try {
        const reply = await askDsh(text)
        console.log(`[dsh] ${Date.now() - started}ms replyLen=${reply.length}`)
        await sendText(chatId, reply || '(agent 没有输出)')
        console.log('[sent] answer delivered')
      } catch (error) {
        console.error('[dsh error]', error?.message ?? error)
        await sendText(chatId, `执行失败：${String(error?.message ?? error).slice(0, 300)}`)
      }
    },
  })

  wsClient.start({ eventDispatcher: dispatcher })
  console.log('bridge-v0 up (Feishu long connection + dsh headless)')
}

main().catch((error) => { console.error(error); process.exit(1) })
