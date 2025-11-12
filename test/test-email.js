import amqplib from "amqplib";

async function send() {
  const conn = await amqplib.connect("amqp://localhost:5672");
  const channel = await conn.createChannel();

  await channel.assertExchange("notifications.direct", "direct", {
    durable: true,
  });

  const msg = JSON.stringify({
    request_id: "test0004",
    to_email: "chibueze.dev01@gmail.com",
    subject: "Test Pizza!",
    html_body: "<p>Hey! Pizza ready 🍕</p>",
    text_body: "Hey! Pizza ready",
  });

  channel.publish("notifications.direct", "email.queue", Buffer.from(msg), {
    persistent: true,
  });

  console.log("Sent test email!");
  await channel.close();
  await conn.close();
}

send();
