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

const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Email Service on :3000");
    await startConsumer();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
