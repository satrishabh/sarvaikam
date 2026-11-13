# PostgreSQL replication check — 13 November 2026

Read-only inspection of the current GKE context and Cloud SQL project. No instances, replication settings, or database contents were changed.

| Component | Observed state |
| --- | --- |
| Sarvaikam, namespace `dev` | Application pod running; PostgreSQL reachable inside the pod on localhost |
| Current database | `sarvaikam` |
| `pg_is_in_recovery()` | `false`: primary role, not in recovery |
| `pg_stat_replication` | 0 rows: no connected streaming replicas |
| `pg_stat_wal_receiver` | 0 rows: no active upstream WAL receiver |
| Cloud SQL `aio-002` | PostgreSQL 18, `RUNNABLE`, asia-south1, `ZONAL`; no master reference or replica list |
| Cloud SQL `aio-001` | PostgreSQL 18, `STOPPED`, asia-south2, `ZONAL`; no master reference or replica list |
| Legacy `aio-platform/aio-postgres` StatefulSet | Scaled to 0 |
| `dev/sarvaikam` deployment storage | 0 declared volumes and 0 container volume mounts |
| Persistent volume claims in `dev` | None |

Sarvaikam is currently a standalone PostgreSQL primary with no connected replicas. The two Cloud SQL instances are independent instances, not a primary/replica pair. A stopped independent instance does not provide active replication. This inspection establishes observed roles and active streams; it does not establish backup recoverability or configured-but-disconnected external replicas.

**Deployment blocker:** the running embedded database has no persistent mount. Replacing its application pod would lose that pod's database contents. Before rolling out the admin/storage changes, take a database backup and move the database to persistent storage or a separately managed PostgreSQL instance, restore/verify the data, and configure the application connection. Bucket configuration alone does not preserve course metadata, accounts, progress, or object references. Do not delete or restart the existing pod before preserving its database.

Queries run inside the Sarvaikam pod:

```sql
SELECT current_database(), pg_is_in_recovery() AS is_replica;
SELECT application_name, client_addr, state, sync_state,
       write_lag, flush_lag, replay_lag
FROM pg_stat_replication;
SELECT status, sender_host, sender_port FROM pg_stat_wal_receiver;
```

The repository's `deploy/k8s/postgres.yaml` also defines a single PostgreSQL pod without a replication controller/configuration. Increasing that StatefulSet's replica count does not configure PostgreSQL replication. The all-in-one embedded database mode is intended for a single application replica. A future replicated setup requires an explicitly provisioned primary/replica topology and connection configuration; none was created by this check.
