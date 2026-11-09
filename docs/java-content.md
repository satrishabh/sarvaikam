# Java content intake

All Java content is organized by Starter, Intermediate, Advanced, and optional Deep Dive level, using the same structure as the rest of the catalogue. See [the learning-level guide](learning-levels.md) for classification, authoring, and validation details.

Received 9 November 2026: reference material and course-outline screenshots supplied as inspiration for the Java learning path, topic coverage, and lesson structure.

The supplied text is retained locally at `content-inbox/drafts/java/source-gsdc-java-full-stack.txt`, excluded from Git and Docker. It is not a downloadable resource or application asset.

`40-java-full-stack.json` adds eight condensed study guides to the existing `languages/java` topic. The reference outline helps guide topic coverage. Each guide includes explanations, bounded practice tasks, and self-review prompts, providing a starting point for more detailed lessons as additional resources arrive.

| Guide | Scope |
|---|---|
| Core Java | Build setup, execution, modularity, validation, immutability |
| OOP | Domain boundaries, generics, concurrent workflows |
| Collections | Ordering, streams, atomic updates, workload trade-offs |
| JDBC | Transactions, pooling, query plans, pagination |
| Hibernate | Relationships, loading, query counts |
| Spring | Injection, configuration, access control, operations |
| Full-stack capstone | API contracts, client states, delivery |
| Frontend | Responsive UI, events, async requests, runtime validation |

Existing Java lessons and URLs are preserved. The seed loader appends missing lessons on startup and does not replace CMS edits. These changes are local repository content; applying them to a running deployment requires rebuilding and restarting the content service.

Next additions should supply runnable worked examples, expected output, selected dependency versions, and technical review evidence. The initial eight guides intentionally contain no unverified framework setup commands. Keep the new lesson slugs stable when adding material; update already-loaded lessons through Content studio.

## Concurrency and JVM expansion

### Selected resource storage

The user supplied `gs://cotent_bucket` in project `project-d28840cd-be2f-4901-85e`. On 9 November 2026 this existing bucket was connected to the live Learn deployment in namespace `dev`. Public access prevention and uniform bucket-level access were verified. Its existing US multi-region location and seven-day soft-delete policy were preserved.

The runtime uses `GCP_CONTENT_BUCKET=cotent_bucket` and `GCP_SIGNING_SERVICE_ACCOUNT=sarvaikam-content@project-d28840cd-be2f-4901-85e.iam.gserviceaccount.com`. A dedicated Kubernetes service account `dev/sarvaikam-content` is linked through Workload Identity. The Google service account has bucket-scoped Object User access, self-scoped Token Creator for signing, and a Workload Identity User binding for that exact Kubernetes identity. No private key was created.

CORS permits only `https://learn.sarvaikam.com` and `https://sarvaikam-dev.34.180.3.18.nip.io`, using the configuration in `deploy/content-storage-cors.json`. Localhost is not enabled by this deployment configuration.

Storage settings are applied as Helm parameter overrides on the existing `argocd/sarvaikam-dev` Application, preserving Argo CD self-healing and the existing secret references. `deploy/content-storage-argocd-dev.patch.json` records the applied patch; `deploy/aio-content-storage-values-dev.yaml` provides equivalent values for the GitOps repository. That repository has not been committed or pushed by this change. Recreating the Application from a source that omits these overrides requires restoring them or merging the supplied values first.

Verification from the configured app pod passed Workload Identity credential acquisition, IAM URL signing, signed PUT with exact byte length and overwrite prevention, signed GET with matching contents, anonymous access denial, and removal of the uniquely named smoke-test object. The deployment rollout completed. The bucket's retention policies may retain the removed test object. This verifies the storage path; a signed-in Content studio upload and its database association have not been exercised.

Reapply with `deploy/configure-content-storage-dev.ps1` on the expected Windows operator environment. Run `deploy/verify-content-storage.cjs` inside the configured app pod to check storage independently of user sessions. Do not use the Cloud Console browser URL as the bucket setting. Existing Terraform creates a differently named bucket; do not apply it assuming it adopts this bucket automatically.

Attaching a resource through Content studio creates the lesson association and verifies the object. Manually placing a file in the bucket does not import it into the catalogue. Keep editorial source material separate from learner-downloadable resources. Files must remain demand-loaded, without adding bucket reads or document parsing to application startup.

`50-java-concurrency-jvm.json` adds ten lessons after the initial pack:

1. Thread lifecycle, atomicity, visibility, ordering, and the memory model.
2. Executors, futures, interruption, cancellation, and overload.
3. Monitors, explicit locks, conditions, and deadlock prevention.
4. Atomics, concurrent collections, queues, and coordination tools.
5. Java 21 virtual threads, pinning, admission limits, and scarce resources.
6. CompletableFuture composition and the boundary around Java 21 preview APIs.
7. Class loading, JVM memory areas, interpretation, JIT, and deoptimization.
8. Reachability, collector mechanics, G1, and Java 21 generational ZGC.
9. JFR, GC logs, memory budgets, and measurement-led performance investigation.
10. Records, sealed types, exhaustive switches, domain invariants, and clean code.

Each lesson has a practice task, self-review criteria, and official references. Examples target stable Java 21 APIs. Structured concurrency and scoped values are explicitly identified as previews in Java 21. Pinning guidance is scoped to Java 21 rather than assumed to apply unchanged to newer releases.

Validation on 9 November 2026: the four standalone examples compile with `javac --release 21` and produce their documented output on the locally installed JDK 23. Native JDK 21 execution, workload benchmarks, and the diagnostic labs have not been run. Seed validation checks required lesson fields and unique topic/lesson keys across all 194 lessons. Existing introductory JVM and concurrency lessons remain in place; the expansion provides more precise treatment of collector-specific layouts, shallow record immutability, and heap versus total process budgets.
