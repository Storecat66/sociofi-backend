import nodemailer, { Transporter } from "nodemailer";
import env from "../config/env";

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

function createTransport(options?: {
  host?: string;
  port?: number;
  secure?: boolean;
  timeout?: number;
}): Transporter {
  return nodemailer.createTransport({
    host: options?.host ?? env.SMTP_HOST,
    port: options?.port ?? env.SMTP_PORT,
    secure: options?.secure ?? env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    // Timeouts (ms)
    connectionTimeout: options?.timeout ?? env.SMTP_TIMEOUT,
    greetingTimeout: options?.timeout ?? env.SMTP_TIMEOUT,
    socketTimeout: options?.timeout ?? env.SMTP_TIMEOUT,
  });
}

// Primary transporter created from env
let transporter = createTransport();

// Verify transporter on load and try a fallback to port 587 (STARTTLS) if the
// primary connection times out. This helps in environments where port 465 is
// blocked but 587 (STARTTLS) works (common in cloud hosts).
async function verifyTransporter() {
  try {
    console.log("Verifying SMTP transporter with options:", {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      timeout: env.SMTP_TIMEOUT,
    });

    await transporter.verify();
    console.log("SMTP transporter verified successfully");
  } catch (err: any) {
    console.error("SMTP transporter verification failed:", err?.message || err);

    // If using SMTPS (port 465) and verification timed out, try a STARTTLS
    // fallback on port 587 (secure: false). Do not overwrite env; just try
    // to create a working transporter.
    const isLikelyTimedOut = err?.code === "ETIMEDOUT" || /timeout/i.test(err?.message);
    if (isLikelyTimedOut && env.SMTP_PORT === 465) {
      console.log("Attempting fallback to port 587 with STARTTLS (secure: false)...");
      const fallback = createTransport({ host: env.SMTP_HOST, port: 587, secure: false, timeout: env.SMTP_TIMEOUT });
      try {
        await fallback.verify();
        transporter = fallback;
        console.log("Fallback SMTP transporter (587 STARTTLS) verified and will be used");
      } catch (fallbackErr: any) {
        console.error("Fallback transporter verification also failed:", fallbackErr?.message || fallbackErr);
      }
    }
  }
}

// Start verification but don't block module import. This provides helpful
// diagnostics in logs during startup on Render/production.
verifyTransporter().catch((e) => console.error("Unexpected error verifying transporter:", e));

export async function sendMail(opts: SendMailOptions): Promise<void> {
  console.log("Mail send options (transport):", {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
  });

  const from = opts.from || `Socio-Fi <${env.SMTP_USER}>`;

  try {
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
  } catch (err: any) {
    // Provide a clearer error message for common network failures
    console.error("Failed to send email:", err?.message || err);
    // rethrow so callers can handle the error
    throw err;
  }
}
