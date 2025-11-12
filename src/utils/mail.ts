import { Resend } from 'resend';
import env from '../config/env';

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

// Initialize Resend with API key
const resend = new Resend(env.RESEND_API_KEY);

// Test Resend connection on startup
async function verifyConnection() {
  try {
    console.log('🔍 Verifying Resend configuration with API key:', env.RESEND_API_KEY.slice(0, 10) + '...');
    console.log('✅ Resend initialized with from:', `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`);
    // await checkResendDomain('socio-fi.com');
  } catch (err: any) {
    console.error('❌ Resend initialization error:', err?.message || err);
  }
}

// Call on module load
verifyConnection().catch((e) => console.error('Unexpected error initializing Resend:', e));

export async function sendMail(opts: SendMailOptions): Promise<void> {
  const from = opts.from || `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;

  try {
    console.log(`📧 Sending email to ${opts.to} with subject: "${opts.subject}"`);

    // Build mail data for Resend
    const mailData: any = {
      from,
      to: opts.to,
      subject: opts.subject,
    };

    if (opts.html) mailData.html = opts.html;
    if (opts.text) mailData.text = opts.text;
    if (!opts.text && !opts.html) mailData.text = '';

    const { data, error } = await resend.emails.send(mailData);

    if (error) {
      console.error(`❌ Failed to send email to ${opts.to}:`, error.message);
      throw new Error(error.message);
    }

    console.log(`✅ Email sent successfully to ${opts.to} (ID: ${data?.id})`);
  } catch (err: any) {
    console.error(`❌ Resend error while sending email to ${opts.to}:`, err?.message || err);
    throw err;
  }
}

export async function checkResendDomain(domainName: string): Promise<void> {
  try {
    console.log(`🔍 Checking Resend domain status for "${domainName}"...`);
    const { data, error } = await resend.domains.list();

    if (error) {
      console.error('❌ Error fetching Resend domains:', error.message);
      return;
    }

    const domain = data?.data?.find((d: any) => d.name === domainName);

    if (!domain) {
      console.warn(`⚠️ Domain "${domainName}" not found in your Resend account.`);
      console.log('💡 You can add it via https://resend.com/domains');
      return;
    }

    console.log(`📦 Domain found: ${domain.name}`);
    console.log(`   → Status: ${(domain as any).status || 'unknown'}`);

    // Check if domain is verified (Resend domains return status, not a verified property)
    if ((domain as any).status !== 'success') {
      console.log('🕒 Domain pending verification...');
      console.log('💡 Complete DNS verification in your Resend dashboard at https://resend.com/domains');
    } else {
      console.log('✅ Domain already verified and authorized for sending.');
    }
  } catch (err: any) {
    console.error('❌ Error checking Resend domain:', err.message);
  }
}
