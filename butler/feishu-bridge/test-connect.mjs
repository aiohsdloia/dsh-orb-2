// Minimal Feishu long-connection probe.
// Proves: credentials work, WSClient connects, im.message.receive_v1 arrives,
// and the bot can reply. No dsh involved yet.

import * as Lark from '@larksuiteoapi/node-sdk'

const appId = process.env.FEISHU_APP_ID
const appSecret = process.env.FEISHU_APP_SECRET
if (!appId || !appSecret) {
  console.error('missing FEISHU_APP_ID / FEISHU_APP_SECRET')
  process.exit(1)
}

const client = new Lark.Client({ appId, appSecret })
const wsClient = new Lark.WSClient({ appId, appSecret, loggerLevel: Lark.LoggerLevel.info })

function extractText(message) {
  try {
    const parsed = JSON.parse(message.content ?? '{}')
    return typeof parsed.text === 'string' ? parsed.text : JSON.stringify(parsed)
  } catch {
    return ''
  }
}

const dispatcher = new Lark.EventDispatcher({}).register({
  'im.message.receive_v1': async (data) => {
    const message = data.message
    const chatId = message.chat_id
    const text = extractText(message)
    const openId = data.sender?.sender_id?.open_id
    console.log(`[recv] chat=${chatId} type=${message.message_type} from=${openId} text=${JSON.stringify(text)}`)

    try {
      const res = await client.im.v1.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text: `收到：${text}` }),
        },
      })
      console.log(`[sent] echo ok code=${res?.code}`)
    } catch (error) {
      console.error('[send error]', error?.response?.data ?? error?.message ?? error)
    }
  },
})

wsClient.start({ eventDispatcher: dispatcher })
console.log('WSClient starting (long connection)...')
