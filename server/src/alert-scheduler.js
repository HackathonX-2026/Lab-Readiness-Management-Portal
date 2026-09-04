import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { listLabs } from './db.js';
import { logger } from './logger.js';
import { sendEmail, shouldSendAlert, buildOverdueLabAlertEmail } from './mailer.js';

/**
 * Check all labs for those that are nearing their workshop date
 * and send alert notifications if not yet Passed.
 *
 * Alert recipients are pulled from the app's configured manager/admin emails.
 */
export async function checkAndSendOverdueAlerts() {
  try {
    const now = new Date();
    const labs = listLabs({ limit: 5000 });

    // Filter labs that are overdue (0-3 days until workshop and NOT Passed)
    const overdueLabsRaw = labs.filter(lab => {
      if (!lab.upcomingWorkshopDate) return false;
      const d = parseISO(lab.upcomingWorkshopDate);
      if (!isValid(d)) return false;
      const daysUntil = differenceInCalendarDays(d, now);
      return daysUntil >= 0 && daysUntil <= 3 && lab.testStatus !== 'Passed';
    });

    // Log overdue labs for visibility (stores in structured logs)
    if (overdueLabsRaw.length > 0) {
      logger.info(`[ALERTS] Found ${overdueLabsRaw.length} overdue lab(s):`, 
        overdueLabsRaw.map(l => ({
          labName: l.labName,
          trackName: l.trackName,
          workshopDate: l.upcomingWorkshopDate,
          status: l.testStatus,
          assignedTo: l.assignedTo,
          reviewer: l.reviewer
        }))
      );
    }

    // Send emails if alerts are enabled and we have recipient addresses
    // For now, store potential recipients from the form (would need separate config)
    let alertsSent = 0;

    for (const lab of overdueLabsRaw) {
      const daysUntil = differenceInCalendarDays(parseISO(lab.upcomingWorkshopDate), now);
      const recipients = [];

      // In a production system, you'd query a "team_members" table for their emails
      // For now, we'll document how to configure recipients
      if (process.env.ALERT_MANAGER_EMAIL && shouldSendAlert(process.env.ALERT_MANAGER_EMAIL, lab.id)) {
        recipients.push(process.env.ALERT_MANAGER_EMAIL);
      }

      for (const recipient of recipients) {
        const html = buildOverdueLabAlertEmail(lab, daysUntil);
        const result = await sendEmail({
          to: recipient,
          subject: `⚠️ Lab "${lab.labName}" - Workshop in ${daysUntil} day(s) - Action Required`,
          html
        });
        if (result.success) alertsSent++;
      }
    }

    if (alertsSent > 0) {
      logger.info(`[ALERTS] Sent ${alertsSent} alert email(s)`);
    }
  } catch (err) {
    logger.error('[ALERTS] Error checking for overdue labs:', err);
  }
}
