import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';

const origin = process.env.CHAT_ORIGIN || 'https://chatpalez.com';
const conversationId = process.env.CHAT_CONVERSATION_ID;
const tokens = [process.env.CHAT_TOKEN_A, process.env.CHAT_TOKEN_B];
if (!conversationId || tokens.some((token) => !token)) {
  console.error('Set CHAT_CONVERSATION_ID, CHAT_TOKEN_A, and CHAT_TOKEN_B in the process environment.');
  process.exit(2);
}

const timeoutMs = 15000;
const sockets = [];
function deadline(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs))
  ]);
}
function connect(token, label) {
  const socket = io(origin, {
    path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'],
    reconnection: false, timeout: timeoutMs, autoConnect: false
  });
  sockets.push(socket);
  return deadline(new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => reject(new Error(`${label} connect failed: ${error.message}`)));
    socket.connect();
  }), `${label} connect`);
}
function emitAck(socket, event, payload) {
  return deadline(new Promise((resolve, reject) => {
    socket.emit(event, payload, (value) => {
      try {
        const ack = typeof value === 'string' ? JSON.parse(value) : value;
        if (!ack || ack.error || ack.ok === false) throw new Error(String(ack?.error || 'Rejected acknowledgement'));
        resolve(ack);
      } catch (error) { reject(error); }
    });
  }), `${event} acknowledgement`);
}
async function history(token) {
  const url = new URL('/apis/php/chat/messages', origin);
  url.searchParams.set('conversation_id', conversationId);
  url.searchParams.set('offset', '0');
  const response = await deadline(fetch(url, {
    headers: { Accept: 'application/json', 'x-mobile-client': 'chatpalez-mobile-v1', 'x-auth-token': token }
  }), 'HTTP chat history');
  const envelope = await response.json();
  if (!response.ok || envelope.status !== 'success') throw new Error(`HTTP chat history rejected (${response.status})`);
  return envelope.data?.messages ?? [];
}
async function sendAndVerify(sender, receiver, senderToken, receiverToken, label) {
  const marker = `mobile-socket-check-${randomUUID()}`;
  const received = deadline(new Promise((resolve) => {
    const listener = (event) => {
      if (String(event?.conversation?.conversation_id) !== String(conversationId)) return;
      receiver.off('event_server_message_received', listener);
      resolve(event);
    };
    receiver.on('event_server_message_received', listener);
  }), `${label} recipient event`);
  const ack = await emitAck(sender, 'event_client_send_message', {
    conversation_id: conversationId, message: marker, photo: '', video: '', voice_note: '', recipients: ''
  });
  if (String(ack.conversation_id) !== String(conversationId)) throw new Error(`${label} acknowledgement conversation mismatch`);
  await received;
  const histories = await Promise.all([history(senderToken), history(receiverToken)]);
  const matches = histories.map((messages) => messages.filter((item) => item.message === marker));
  if (matches.some((items) => items.length !== 1)) throw new Error(`${label} marker was not found exactly once in both histories`);
  const messageId = matches[0][0].message_id;
  if (!messageId || String(messageId) !== String(matches[1][0].message_id)) {
    throw new Error(`${label} sender and recipient histories have different message IDs`);
  }
  const acknowledgedId = ack.last_message_id ?? ack.last_message?.message_id;
  if (acknowledgedId && String(acknowledgedId) !== String(messageId)) {
    throw new Error(`${label} acknowledgement message ID mismatch`);
  }
  console.log(`${label}: connected, acknowledged, recipient event, and matching single history item (ID ${messageId}).`);
}
try {
  const [a, b] = await Promise.all(tokens.map((token, index) => connect(token, index ? 'B' : 'A')));
  await Promise.all([a, b].map((socket) => emitAck(socket, 'event_client_open_thread', { conversation_id: conversationId })));
  await sendAndVerify(a, b, tokens[0], tokens[1], 'A → B');
  await sendAndVerify(b, a, tokens[1], tokens[0], 'B → A');
  console.log('Socket.IO two-account delivery gate passed. Check database row count separately if server access is available.');
} catch (error) {
  console.error(`Socket.IO delivery gate failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.disconnect();
}
