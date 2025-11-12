📧 **Email Service API**

## Overview

This Node.js Fastify microservice is engineered for asynchronous email sending, integrating with RabbitMQ for robust message consumption, Redis for idempotent processing, and employing a sophisticated circuit breaker pattern for resilient email delivery via multiple external providers.

## Features

- **Asynchronous Processing**: Handles email sending off the critical path using RabbitMQ message queues for non-blocking operations.
- **Idempotent Email Delivery**: Prevents duplicate email dispatches with Redis-backed request ID tracking, ensuring each email request is processed exactly once.
- **Circuit Breaker Pattern**: Enhances system resilience by isolating failures in external email providers (SendGrid, SMTP), preventing cascading outages.
- **Multiple Email Providers**: Supports dynamic fallback between primary (SendGrid) and secondary (SMTP) email providers for high availability and fault tolerance.
- **Dead Letter Queue (DLQ)**: Manages failed messages gracefully after configured retries, ensuring no data loss and enabling manual inspection of unprocessable messages.
- **Containerization**: Packaged with Docker for consistent, isolated, and scalable deployments across various environments.
- **High-Performance Logging**: Utilizes Pino for structured and efficient logging, providing clear insights into service operations and debugging.

## Getting Started

### Installation 🛠️

To set up and run this service locally, follow these steps:

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/onahchibueze/email-service.git
    cd email-service
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Build and Run with Docker (Recommended for production-like environment)**:
    Ensure Docker is installed and running. Create a `.env` file in the project root with the required environment variables (see below).
    ```bash
    docker build -t email-service .
    docker run -p 3000:3000 --env-file ./.env email-service
    ```
4.  **Run Locally (for development)**:
    First, ensure you have Node.js (v20 or newer) installed. Then, configure your `.env` file.
    ```bash
    npm run dev # Starts the service with nodemon for live reloading
    # or
    npm start # Starts the service in production mode
    ```

### Environment Variables ⚙️

This service requires the following environment variables to be configured. Create a `.env` file in the project root directory:

```dotenv
# RabbitMQ Connection URL
RABBITMQ_URL=amqp://localhost

# Redis Connection URL for Idempotency
REDIS_URL=redis://localhost:6379

# Default Sender Email Address
FROM_EMAIL=no-reply@example.com

# SendGrid API Key (Primary Email Provider)
SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY_HERE

# SMTP Configuration (Fallback Email Provider)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=YOUR_SMTP_USERNAME
SMTP_PASS=YOUR_SMTP_PASSWORD

# Message Consumer Retry Settings
MAX_RETRIES=4         # Maximum number of retries before a message is sent to the Dead Letter Queue
BASE_DELAY=2000       # Base delay in milliseconds for exponential backoff between retries (e.g., 2s, 4s, 8s, 16s)
```

## Usage

This service is designed to operate as a background worker, consuming email messages from a RabbitMQ queue and dispatching them using the configured email providers.

### How to Trigger Email Sending

To send an email, a producing application should publish a message to the `notifications.direct` exchange in your RabbitMQ instance, using `email.queue` as the routing key.

**Example RabbitMQ Message Payload:**

```json
{
  "request_id": "a-unique-uuid-for-this-email-transaction",
  "to_email": "recipient@example.com",
  "subject": "Important Notification from Our Service",
  "text_body": "Hello! This is a plain text version of your email. We hope you're having a great day.",
  "html_body": "<h1>Hello!</h1><p>This is an <b>HTML formatted</b> email from our service. We hope you're having a great day!</p>"
}
```

Upon receiving a message, the service will:

1.  Check for message duplication using Redis-backed idempotency.
2.  Attempt to send the email via SendGrid.
3.  If SendGrid fails, it will gracefully fall back to sending via SMTP.
4.  If both providers fail, the message will be retried with an exponential backoff strategy for up to `MAX_RETRIES` times.
5.  If all retries are exhausted, the message will be moved to the `failed.queue` (Dead Letter Queue) for further inspection.

### Monitoring 📈

The service utilizes Pino for comprehensive, structured logging. Monitor your application logs for insights into email processing status, provider usage, successful deliveries, retry attempts, and errors. These logs are crucial for operational visibility.

## API Documentation

### Base URL

`/api/v1`

### Endpoints

#### GET /api/v1/health

A simple health check endpoint to determine the operational status of the email service.

**Request**:
No request body is required.

**Response**:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  },
  "message": "healthy"
}
```

**Errors**:

- `503 Service Unavailable`:
  ```json
  {
    "success": false,
    "error": "service_unavailable",
    "message": "unhealthy"
  }
  ```
  This status indicates that the service is experiencing internal issues or dependencies are unavailable, preventing it from operating normally.

## Technologies Used

| Technology         | Description                                                                   | Link                                                               |
| :----------------- | :---------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| **Node.js**        | A powerful JavaScript runtime for building scalable server-side applications. | [nodejs.org](https://nodejs.org/)                                  |
| **Fastify**        | An extremely fast and low-overhead web framework for Node.js.                 | [fastify.dev](https://www.fastify.dev/)                            |
| **RabbitMQ**       | A robust, open-source message broker that enables asynchronous communication. | [rabbitmq.com](https://www.rabbitmq.com/)                          |
| **Redis**          | An in-memory data structure store used here for idempotency and caching.      | [redis.io](https://redis.io/)                                      |
| **@sendgrid/mail** | The official Node.js library for integrating with the SendGrid Email API.     | [sendgrid.com](https://sendgrid.com/)                              |
| **Nodemailer**     | A popular module for sending emails from Node.js applications using SMTP.     | [nodemailer.com](https://nodemailer.com/)                          |
| **Pino**           | An extremely fast, low-overhead JSON logger for Node.js.                      | [getpino.io](https://getpino.io/)                                  |
| **dotenv**         | A zero-dependency module that loads environment variables from a `.env` file. | [npmjs.com/package/dotenv](https://www.npmjs.com/package/dotenv)   |
| **ioredis**        | A robust and feature-rich Redis client for Node.js.                           | [npmjs.com/package/ioredis](https://www.npmjs.com/package/ioredis) |

## Contributing

We warmly welcome contributions to enhance this email service! ✨ Whether it's a new feature, a bug fix, or documentation improvement, your help is valuable.
To contribute:

- Fork the repository to your GitHub account.
- Create a new branch for your feature or bug fix: `git checkout -b feature/your-feature-name`.
- Implement your changes, ensuring they adhere to existing code style and best practices.
- Write clear, concise, and descriptive commit messages.
- Push your branch to your forked repository.
- Open a Pull Request (PR) to the `main` branch of this repository.
- Provide a detailed description of your changes in the PR.

Thank you for helping improve this project! 🙏

## License

This project is licensed under the ISC License. See the `package.json` file for full details.

#

## Badges

[![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-blue?logo=fastify)](https://www.fastify.dev/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-gray?logo=rabbitmq)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/Redis-FF4438?logo=redis&logoColor=white)](https://redis.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/onahchibueze/email-service/graphs/commit-activity)
