/** Guest CVs and guest scans are deleted this many days after their last change
 *  (app/api/cron/purge-guests). The privacy page quotes this constant, so the two cannot drift. */
export const GUEST_RETENTION_DAYS = 90;

/** An interview practice session (its questions, transcript and feedback) is deleted this many days
 *  after it started (app/api/cron/purge-interviews; AG-10). The voice itself is never kept (IV-5). */
export const INTERVIEW_RETENTION_DAYS = 180;
