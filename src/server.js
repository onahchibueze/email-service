import Fastify from "fastify";
import { startConsumer } from "./consumer.js";
import dotenv from "dotenv";

// Add etcd import
import { Etcd3 } from 'etcd3';

dotenv.config();

const app = Fastify({ logger: true });

// Add etcd client
const etcdClient = new Etcd3({
  hosts: [process.env.ETCD_URL?.replace('http://', '') || 'etcd:2379'],
});

// Service registration function
const registerWithEtcd = async () => {
  try {
    const lease = etcdClient.lease(30);
    const leaseId = await lease.grant();
    
    const serviceData = {
      name: 'email-service',
      id: 'email-service-001',
      address: 'email-service',  // Docker service name
      port: 3000,
      registeredAt: new Date().toISOString()
    };
    
    await etcdClient.put('/services/email-service/email-service-001')
      .value(JSON.stringify(serviceData))
      .lease(leaseId);
      
    console.log('✅ Email service registered with etcd');
    
    // Keep lease alive
    setInterval(async () => {
      try {
        await lease.refresh();
      } catch (err) {
        console.error('Failed to refresh etcd lease:', err);
      }
    }, 15000); // Refresh every 15 seconds
    
  } catch (error) {
    console.error('❌ Failed to register email service with etcd:', error);
  }
};

// Deregistration function
const deregisterFromEtcd = async () => {
  try {
    await etcdClient.delete('/services/email-service/email-service-001');
    console.log('✅ Email service deregistered from etcd');
  } catch (error) {
    console.error('❌ Failed to deregister email service from etcd:', error);
  }
};

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
    
    // Register with etcd
    await registerWithEtcd();
    
    // Wait for RabbitMQ before starting consumer
    await waitForRabbitMQ();
    await startConsumer();
  } catch (err) {
    console.error("Failed to start email service:", err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await deregisterFromEtcd();
  await etcdClient.close();
  process.exit(0);
});

start();