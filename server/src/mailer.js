import nodemailer from 'nodemailer';
import { config } from './config.js';
import { logger } from './logger.js';

// Simple in-memory cache to avoid spamming the same person multiple times per day
const emailSentCache = new Map(); // email -> timestamp

/**
 * Send an email notification.
 * For development: logs to console.
 * For production: uses SMTP settings from env variables.
 */
export async function sendEmail({ to, subject, html }) {
  try {
    // In development/demo, just log it
    if (!config.smtpHost) {
      logger.info(`[EMAIL WOULD SEND] To: ${to}, Subject: ${subject}`);
      logger.debug(`[EMAIL CONTENT]\n${html}`);
      return { success: true, mode: 'demo' };
    }

    // Production: send via SMTP
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser ? {
        user: config.smtpUser,
        pass: config.smtpPass
      } : undefined
    });

    const result = await transporter.sendMail({
      from: config.smtpFrom || 'lab-readiness@cloudlabs.local',
      to,
      subject,
      html
    });

    logger.info(`Email sent to ${to}: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (err) {
    logger.error(`Failed to send email to ${to}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Check if we should send an alert email to someone for a specific lab.
 * Returns true if we haven't sent in the last 24 hours.
 */
export function shouldSendAlert(email, labId) {
  const key = `${email}:${labId}`;
  const lastSent = emailSentCache.get(key);
  const now = Date.now();

  if (!lastSent || (now - lastSent) > 24 * 60 * 60 * 1000) {
    emailSentCache.set(key, now);
    return true;
  }

  return false;
}

/**
 * Build HTML email body for overdue lab alert.
 */
export function buildOverdueLabAlertEmail(lab, daysUntilWorkshop) {
  const workshopDate = new Date(lab.upcomingWorkshopDate).toLocaleDateString();
  const urgency = daysUntilWorkshop <= 1 ? '🔴 URGENT' : '⚠️ ACTION REQUIRED';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0b1220; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
    .lab-card { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #dc2626; border-radius: 4px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-in-progress { background: #dbeafe; color: #1e40af; }
    .status-not-started { background: #f3f4f6; color: #4b5563; }
    .footer { font-size: 12px; color: #6b7280; margin-top: 20px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">${urgency} Lab Status Alert</h2>
    </div>
    <div class="content">
      <p>Hi,</p>
      
      <p><strong>Lab: "${lab.labName}"</strong> is scheduled for a workshop in <strong>${daysUntilWorkshop} day(s)</strong> but is not yet marked as Passed.</p>
      
      <div class="lab-card">
        <p style="margin: 0 0 10px 0;"><strong>${lab.trackName}</strong></p>
        <p style="margin: 0 0 10px 0;">📅 <strong>Workshop Date:</strong> ${workshopDate}</p>
        <p style="margin: 0 0 10px 0;">🔬 <strong>Test Status:</strong> <span class="status status-${lab.testStatus === 'Passed' ? 'passed' : lab.testStatus === 'In Progress' ? 'in-progress' : 'not-started'}">${lab.testStatus}</span></p>
        <p style="margin: 0 0 10px 0;">👤 <strong>Assigned To:</strong> ${lab.assignedTo || '(unassigned)'}</p>
        <p style="margin: 0;">✓ <strong>Reviewer:</strong> ${lab.reviewer || '(unassigned)'}</p>
      </div>

      <p><strong>Action Required:</strong></p>
      <ul>
        <li>If testing is complete, mark the lab as <strong>Passed</strong></li>
        <li>If blocked, add a note in the Remarks field explaining the delay</li>
        <li>If reassigning, update the Assigned To field</li>
      </ul>

      <a href="http://localhost:5173/risk" class="button">View in Portal</a>

      <div class="footer">
        <p>Lab Readiness Management Portal | This is an automated alert sent because the workshop is approaching and the lab is not yet marked as Passed.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
