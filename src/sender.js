import { CircuitBreaker } from "./circuit.js";
import { logger } from "./utils.js";

import dotenv from "dotenv";
dotenv.config();

import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";

const sgCircuit = new CircuitBreaker();
const smtpCircuit = new CircuitBreaker();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
export const sendEmail = async (msg) => {
  const mail = {
    to: msg.to_email,
    from: process.env.FROM_EMAIL,
    subject: msg.subject,
    text: msg.text_body || "",
    html: msg.html_body,
  };

  try {
    await sgCircuit.call(async () => {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send(mail);
    });
    logger.info({ request_id: msg.request_id }, "Email sent via SendGrid");
    return { success: true, provider: "sendgrid" };
  } catch (err) {
    logger.warn(
      { err, request_id: msg.request_id },
      "SendGrid failed, trying SMTP"
    );
  }

  try {
    await smtpCircuit.call(async () => {
      await transporter.sendMail(mail);
    });
    logger.info({ request_id: msg.request_id }, "Email sent via SMTP");
    return { success: true, provider: "smtp" };
  } catch (err) {
    logger.error({ err, request_id: msg.request_id }, "All providers failed");
    throw err;
  }
};
