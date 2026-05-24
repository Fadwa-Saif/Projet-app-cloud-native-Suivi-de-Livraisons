const amqplib = require('amqplib');
require('dotenv').config();

const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost';

async function start(retries = 0) {
  try {
    const conn = await amqplib.connect(AMQP_URL);
    const ch = await conn.createChannel();
    await ch.assertExchange('delivery.status', 'fanout', { durable: false });
    const q = await ch.assertQueue('', { exclusive: true });
    await ch.bindQueue(q.queue, 'delivery.status', '');
    console.log('Notification consumer waiting...');
    ch.consume(q.queue, msg => {
      if(!msg) return;
      try{
        const data = JSON.parse(msg.content.toString());
        console.log('Notification received:', data);
        // Here you could send emails, push notifications, store in DB, etc.
      }catch(e){ console.error('Invalid message', e.message); }
      ch.ack(msg);
    });
    // handle connection close
    conn.on('close', () => {
      console.warn('AMQP connection closed, retrying...');
      setTimeout(() => start(0), 2000);
    });
    conn.on('error', (err) => {
      console.error('AMQP connection error', err.message);
    });
  } catch (err) {
    const waitMs = Math.min(30000, 1000 * (retries + 1));
    console.error(`Notification error connecting to AMQP (${AMQP_URL}):`, err.message, `- retrying in ${waitMs}ms`);
    setTimeout(() => start(retries + 1), waitMs);
  }
}

start();
