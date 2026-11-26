# Azure content storage — runbook

Moves Sarvaikam content (lesson bodies, practice, reels, attachments) from the GCS bucket to Azure Blob Storage.
Code: `AzureBlobObjectStore`, `ContentStorageCopyRunner`, `ObjectStoreMigrator` in `services/content-service`.

## Order of operations

| # | Step | Live change? | Needs your approval |
| --- | --- | --- | --- |
| 1 | Run `setup-azure-storage.sh` in Azure Cloud Shell: storage account, container, CORS, identity, federation | Creates Azure resources | Yes |
| 2 | Annotate the Learn service account and label the pod (values printed by step 1) | Helm change | Yes |
| 3 | Run the copy job: `STORAGE_COPY_SOURCE=gcs`, `STORAGE_BACKEND=azure-blob`, one-shot, then exits | Writes blobs to Azure; reads the GCS bucket | Yes; the job needs GCP read access, which is a cross-cloud credential |
| 4 | Check the job's report: 0 missing, 0 mismatched | None | No |
| 5 | Build and pin a new image from `main` (the pinned Azure image predates the storage code) | Image build | Yes |
| 6 | Set `STORAGE_BACKEND=azure-blob` in Learn's Helm values, roll out, then check lessons, practice, reels and a PDF download | Traffic-facing change | Yes |

Keep the GCS bucket until a full week after step 6. Rollback is setting `STORAGE_BACKEND=gcs` again.

## Copy job

The copy job is the same image run with these environment variables:

```
STORAGE_COPY_SOURCE=gcs
STORAGE_BACKEND=azure-blob
AZURE_STORAGE_ACCOUNT=<from step 1>
AZURE_STORAGE_CONTAINER=content
GCP_CONTENT_BUCKET=cotent_bucket
```

It reads the database for every referenced key, copies each object under the same key, and prints a summary.
Exit code 0 means everything is present with matching sizes. Re-running is safe: objects already copied are skipped.
Reels are read from `sarvaikam_reels.reels`; if the database user lacks access, the job says so and the copy still completes for the other tables.

## Before switching traffic

- Upload and read back one test blob with the Learn pod's identity.
- Confirm the browser can upload a file and download an attachment from learn.sarvaikam.com (CORS).
- Confirm nothing in the Learn Helm values still sets `GCP_CONTENT_BUCKET` or `STORAGE_BACKEND=gcs`.
