# IranKetab Discovery production runbook

## Required configuration

Set these values in the deployment secret manager before starting the new
release. Do not put their values in source control.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by web and worker requests. |
| `JWT_SECRET` | Existing application authentication secret. |
| `APP_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL` | The final HTTPS application URL. |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | Required for preview media and catalog cover promotion. |
| `IRANKETAB_DISCOVERY_WORKER_SECRET` | Separate high-entropy secret for the internal worker tick. |
| `IRANKETAB_DISCOVERY_WORKER_ACTOR_ID` | ID of an existing administrator; used only for importer ownership/audit. |

Optional bounds are `IRANKETAB_DISCOVERY_WORKER_BATCH_SIZE` (default 10,
maximum 25), `IRANKETAB_DISCOVERY_SCHEDULER_SOURCE_BATCH_SIZE` (default 10,
maximum 25), and `IRANKETAB_COVER_PREPARATION_CONCURRENCY` (default 3,
maximum 6).

The same tick advances exactly one active publisher import. Publisher
pause/resume state is stored in PostgreSQL, so closing the admin page does not
pause the workflow. Keep the tick scheduled at least once per minute; the UI
also advances one book at a time while an administrator is watching it.

## Deployment sequence

1. Create a verified database backup and keep it outside the application
   container.
2. Deploy the release with the configuration above. The container entrypoint
   runs the guarded Drizzle migration sequence.
3. Confirm migrations `0043` through `0048` are present in
   `drizzle.__drizzle_migrations`. Migration `0048` is additive: it adds the
   import policy enum, source policy field, source-aware job foreign key, and
   its index. Existing sources remain `MANUAL_REVIEW` by design.
4. Restart all web instances after migrations. No separate process binary is
   required, but configure a platform cron to call the worker tick once per
   minute:

```sh
curl --fail --silent --show-error \
  -X POST "https://YOUR_APP/api/internal/iranketab-discovery/tick" \
  -H "Authorization: Bearer $IRANKETAB_DISCOVERY_WORKER_SECRET"
```

5. Confirm a request with no or an invalid bearer secret returns `401`, and a
   valid request returns `200`. A missing worker secret or invalid actor fails
   closed with `503` and does not process jobs.

## Post-deploy checks

1. In Sources, verify the intended source explicitly displays `AUTO_IMPORT`.
   `MANUAL_REVIEW` sources intentionally stop at `NEEDS_REVIEW`.
2. Run discovery for a small source and verify its run diagnostics include
   fetched page URLs and a stop reason.
3. Select one high-confidence candidate and verify a queue job has a non-null
   `discoverySourceId` and the expected import mode.
4. Check worker logs for `worker_policy_decision`, `worker_bridge_completed`,
   and `worker_job_completed`. Each record includes job, candidate, source,
   import mode, decision, and session status without secrets.
5. For `AUTO_IMPORT`, verify `COMPLETED` job, `IMPORTED` candidate, `SUCCESS`
   session, and a linked catalog book. For `MANUAL_REVIEW`, verify
   `NEEDS_REVIEW` and `PREVIEW_READY`.
6. Verify failed jobs include an error code/message. Expired leases are safely
   reclaimed; permanent errors are terminal and do not retry automatically.

## Rollback

Code rollback is safe only after disabling the cron tick and draining or
allowing active worker leases to expire. Do not roll back migration `0048`:
PostgreSQL enum values and additive columns are intentionally retained. Deploy
the prior compatible application version, leave the schema in place, and keep
AUTO_IMPORT sources disabled or set to `MANUAL_REVIEW` until the forward fix is
redeployed. Restore the pre-deploy database backup only for a separately
approved data-recovery operation.
