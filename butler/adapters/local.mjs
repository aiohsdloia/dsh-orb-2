// Local stdin adapter: the default control surface for development.
// No IM SDK, no credentials, no network.

import { createInterface } from 'node:readline'
import { InputAdapter, assertMessage } from './types.mjs'

export class LocalAdapter extends InputAdapter {
  async start() {
    this.started = true
    this.rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'butler> ' })
    this.rl.prompt()

    this.rl.on('line', async (line) => {
      const text = line.trim()
      if (!text) { this.rl.prompt(); return }
      if (text === '/quit' || text === '/exit') { await this.stop(); return }
      const message = assertMessage({
        id: `local-${Date.now()}`,
        channel: 'local',
        conversationId: 'local',
        userId: 'owner',
        text,
      })
      try {
        const reply = await this.onMessage(message)
        if (reply) console.log(reply)
      } catch (error) {
        console.error(`error: ${error.message}`)
      }
      this.rl.prompt()
    })
  }

  async stop() {
    this.started = false
    this.rl?.close()
  }

  async reply(_message, text) {
    console.log(text)
  }
}
