import Fastify from "fastify";
import { startConsumer } from "./consumer.js";
import dotenv from "dotenv";
import { Etcd3 } from 'etcd3';

dotenv.config();

const app = Fastify({ logger: true });

// Add etcd client
const etcdClient = new Etcd3({
  hosts: [process.env.ETCD_URL?.replace('http://', '') || 'etcd:2379'],
});

let leaseInstance = null;

// Service registration function
const registerWithEtcd = async () => {
  try {
    // Create a lease with 30 second TTL
    leaseInstance = etcdClient.lease(30);
    
    // Grant the lease and get the ID
    await leaseInstance.grant();
    
    const serviceData = {
      name: 'email-service',
      id: 'email-service-001',
      address: 'email-service',  // Docker service name
      port: 3000,
      registeredAt: new Date().toISOString()
    };
    
    // Register service with the lease
    await leaseInstance
      .put('/services/email-service/email-service-001')
      .value(JSON.stringify(serviceData));
      
    console.log('✅ Email service registered with etcd');
    
    // Set up keep-alive for the lease
    // This keeps the lease alive automatically
    leaseInstance.on('lost', () => {
      console.error('⚠️ Lease lost! Attempting to re-register...');
      // Attempt to re-register
      setTimeout(() => registerWithEtcd(), 5000);
    });
    
  } catch (error) {
    console.error('❌ Failed to register email service with etcd:', error);
    // Retry registration after 5 seconds
    setTimeout(() => registerWithEtcd(), 5000);
  }
};

// Deregistration function
const deregisterFromEtcd = async () => {
  try {
    // Revoke the lease (this will delete all keys associated with it)
    if (leaseInstance) {
      await leaseInstance.revoke();
    }
    // Also explicitly delete the key
    await etcdClient.delete().key('/services/email-service/email-service-001');
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

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await deregisterFromEtcd();
  await etcdClient.close();
  process.exit(0);
});

start();