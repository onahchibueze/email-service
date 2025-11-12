import amqplib from "amqplib";
import { sendEmail } from "./sender.js";
import { isDuplicate, sleep, logger } from "./utils.js";

let channel;

export const startConsumer = async () => {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL);
  channel = await conn.createChannel();

  const exchange = "notifications.direct";
  const queue = "email.queue";
  const dlq = "failed.queue";

  await channel.assertExchange(exchange, "direct", { durable: true });
  await channel.assertQueue(queue, {
    durable: true,
    deadLetterExchange: exchange,
    deadLetterRoutingKey: dlq,
  });
  await channel.assertQueue(dlq, { durable: true });

  await channel.bindQueue(queue, exchange, "email.queue");
  await channel.bindQueue(dlq, exchange, dlq);

  channel.consume(
    queue,
    async (msg) => {
      if (!msg) return;

      let payload;
      try {
        payload = JSON.parse(msg.content.toString());
      } catch (e) {
        channel.nack(msg, false, false);
        return;
      }

      const { request_id, retry_count = 0, ...emailData } = payload;

      if (await isDuplicate(request_id)) {
        logger.info({ request_id }, "Duplicate message, skipping");
        channel.ack(msg);
        return;
      }

      try {
        await sendEmail({ ...emailData, request_id });
        channel.ack(msg);
      } catch (err) {
        const nextRetry = retry_count + 1;
        const maxRetries = parseInt(process.env.MAX_RETRIES) || 4;

        if (nextRetry >= maxRetries) {
          logger.error({ request_id, retry_count }, "Max retries → DLQ");
          channel.publish(exchange, dlq, msg.content, { persistent: true });
          channel.ack(msg);
        } else {
          const delay = (process.env.BASE_DELAY || 2000) * 2 ** retry_count;
          logger.warn({ request_id, retry_count, delay }, "Retrying...");

          setTimeout(() => {
            const newPayload = JSON.stringify({
              ...payload,
              retry_count: nextRetry,
            });
            channel.publish(exchange, "email.queue", Buffer.from(newPayload), {
              persistent: true,
            });
            channel.ack(msg);
          }, delay);
        }
      }
    },
    { noAck: false }
  );

  logger.info("Email Consumer Started");
};
