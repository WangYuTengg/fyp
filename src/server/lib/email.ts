import nodemailer from 'nodemailer';

const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: (Number(process.env.SMTP_PORT) || 587) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!transporter) {
    console.log(`[Email] SMTP not configured. Would send to ${to}: ${subject}`);
    console.log(`[Email] HTML body:\n${html}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    return false;
  }
}

export function buildPasswordResetEmail(resetUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Password Reset Request</h2>
      <p>You requested a password reset for your UML Platform account.</p>
      <p>Click the button below to set a new password. This link expires in 1 hour.</p>
      <div style="margin: 24px 0;">
        <a href="${resetUrl}"
           style="background-color: #2563eb; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="color: #6b7280; font-size: 12px;">
        Or copy this link: ${resetUrl}
      </p>
    </div>
  `.trim();
}
