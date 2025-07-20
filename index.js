import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import P from 'pino';
import fetch from 'node-fetch';
import fs from 'fs';
import 'dotenv/config';

const config = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  prefix: "!"
};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async mUpdate => {
    const m = mUpdate.messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const msg = m.message.conversation ||
      m.message.extendedTextMessage?.text || '';

    if (msg === `${config.prefix}infogroup` && from.endsWith('@g.us')) {
      const meta = await sock.groupMetadata(from);
      const txt = `*Nama Grup:* ${meta.subject}\n*Peserta:* ${meta.participants.length}\n*Deskripsi:* ${meta.desc || 'Tidak ada deskripsi'}`;
      await sock.sendMessage(from, { text: txt }, { quoted: m });
      return;
    }

    if (!msg.startsWith(config.prefix)) {
      const res = await askChatGPT(msg);
      await sock.sendMessage(from, { text: res }, { quoted: m });
    }
  });
}

async function askChatGPT(text) {
  try {
    const req = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: text }],
        max_tokens: 200
      })
    });
    const json = await req.json();
    return json.choices?.[0]?.message?.content || '⚠️ Gagal dapet jawaban.';
  } catch (e) {
    console.error(e);
    return '⚠️ Error komunikasi ke ChatGPT.';
  }
}

startBot();
