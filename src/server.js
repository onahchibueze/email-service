import Fastify from "fastify";
import { startConsumer } from "./consumer.js";
import dotenv from "dotenv";

dotenv.config();

const app = Fastify({ logger: true });

app.get("/api/v1/health", async () => {
  try {
    return {
      success: true,
      data: { status: "ok" },
      message: "healthy",
    };
  } catch (err) {
    return {
      success: false,
      error: "service_unavailable",
      message: "unhealthy",
    };
  }
});

// Wait for RabbitMQ to be ready before starting consumer
const waitForRabbitMQ = async (retries = 30) => {
  const amqplib = await import("amqplib");
  
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await amqplib.connect(process.env.RABBITMQ_URL);
      await conn.close();
      console.log("✅ RabbitMQ is ready");
      return true;
    } catch (error) {
      console.log(`⏳ Waiting for RabbitMQ... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error("RabbitMQ connection timeout");
};

const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Email Service on :3000");
    
    // Wait for RabbitMQ before starting consumer
    await waitForRabbitMQ();
    await startConsumer();
  } catch (err) {
    console.error("Failed to start email service:", err);
    process.exit(1);
  }
};

start();