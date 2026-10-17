/** Guest CVs and guest scans are deleted this many days after their last change
 *  (app/api/cron/purge-guests). The privacy page quotes this constant, so the two cannot drift. */
export const GUEST_RETENTION_DAYS = 90;
