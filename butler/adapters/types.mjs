/**
 * Input adapter contract.
 *
 * The assistant core never imports QQ/WeChat/Feishu SDKs directly. An adapter
 * converts its native events into IncomingMessage and sends replies back.
 *
 * @typedef {object} IncomingMessage
 * @property {string} id              stable message id (for dedupe/idempotency)
 * @property {string} channel         "local" | "qq" | "wechat" | "feishu" | "email"
 * @property {string} conversationId  chat/thread key used for session mapping
 * @property {string} userId          sender id (allowlist target)
 * @property {string} text            plain text (non-text can be rejected or transcribed)
 * @property {unknown} [raw]          original event, for debugging only
 */

export class InputAdapter {
  /** @param {{ onMessage: (msg: IncomingMessage) => Promise<string|void> }} options */
  constructor({ onMessage } = {}) {
    this.onMessage = onMessage
    this.started = false
  }

  async start() {
    throw new Error('start() not implemented')
  }

  async stop() {
    this.started = false
  }

  /**
   * @param {IncomingMessage} message
   * @param {string} text
   */
  async reply(message, text) {
    throw new Error('reply() not implemented')
  }
}

export function assertMessage(message) {
  for (const key of ['id', 'channel', 'conversationId', 'userId', 'text']) {
    if (!message?.[key]) throw new Error(`invalid IncomingMessage: missing ${key}`)
  }
  return message
}
