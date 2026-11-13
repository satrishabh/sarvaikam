# Add content from your admin login

Open `/admin` and choose **Sign in to admin**. Sign in with your normal account that has `content.manage`; the login returns you to Content studio. Users without that permission cannot access the editing tools, and the backend protects all write endpoints.

## A new course, step by step

1. **Courses & subjects:** create a subject if needed. Enter a course name, choose its subject, add a summary and starting level, then **Save course**. URLs are generated from names. Select an existing course/subject to edit it; its URL remains fixed.
2. Choose **Add lesson steps**, or open **Lesson steps & uploads** and select a course. Enter the heading, step number, and learning level.
3. Write normally with **Write in sections**. Add Explanation, Example, Practice, Self-review, and Sources sections with the buttons. Alternatively upload a `.md`, `.markdown`, or `.txt` file. Importing replaces the current text after confirmation; reading a file alone does not publish it. The Markdown editor remains available for code samples and advanced formatting.
4. Choose **Preview lesson**, check the result, then **Publish lesson step**. A standard lesson becomes public when saved; an exclusive lesson requires exclusive access. Lessons currently have no draft state. Closing/reloading with unsaved lesson changes triggers the browser's unsaved-work warning.
5. Use **Learning resources** below the saved lesson to upload PDFs, ZIPs, MP4, WebM, or text files. Upload progress and verification appear here. Resources must finish uploading and verification before they are available. If verification fails, use **Retry file verification**. The existing configured limit is up to 2 GB, subject to the backend's upload setting.
6. Open **Learning paths**. Select a path, add the course, use the up/down buttons to set the sequence, edit priority/outcomes if needed, and **Save learning path**. Courses with no lessons stay hidden from learners' path sequences. Priority 1 appears first; ties sort by path slug.

## Reels

In **Reels**, choose the course and lesson step, enter a heading, write short content or upload a text/Markdown file (up to 2,000 characters), and add the original source name and HTTPS URL. The URL is generated from the heading. Leave **Publish to reels** unchecked to save a draft. Check it and save when ready to publish. Existing reel URLs stay fixed when headings change.

## Storage and deployment

The admin forms call the backend; no database console or manual bucket object reference is needed. The backend writes body objects to the configured private bucket and saves metadata/references in PostgreSQL. Attachments upload using short-lived URLs issued by the backend. Reels still require their separately configured PostgreSQL database.

The new UI, path write endpoint, and prior content-storage migrations need to be built and deployed before this workflow is available on the live site. See [backend rollout](backend-content.md). In local development without a configured bucket, text is stored in PostgreSQL; attachment uploads report a configuration error until cloud storage is available.

The 13 November live preflight found an embedded database without a persistent mount. See the [replication and storage check](postgres-replication-check.md). Preserve that database and configure persistent storage before replacing the live pod.

Validation completed: production frontend build and TypeScript checks; 23 backend tests; 27 frontend learning/reader/authoring tests; isolated browser checks covering course creation, lesson sections/preview/publication, course ordering in a path, reel text upload/draft save, mobile layout, and the permission gate. Browser APIs were mocked locally; no live content was written by these checks.

Backend writes: `PUT /api/content/admin/categories`, `/admin/topics`, `/admin/lessons`, `/admin/paths`, and `/admin/reels`; resource endpoints remain under `/admin/lessons/{id}/assets/upload` and `/admin/assets/{id}/complete`. Path writes validate course existence and duplicate membership, then replace the path's ordered membership and outcomes in one database transaction.
