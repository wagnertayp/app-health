---
name: App Storage SDK compatibility
description: Compatibility constraints for the supplied Replit sidecar credential configuration.
---

Keep the App Storage sidecar credential setup compatible with the Google SDK major versions in use. Revalidate server-side metadata, read and write access before upgrading Google Cloud Storage or Google Auth to a new major.

**Why:** The supplied sidecar credentials worked with Storage 7 and Google Auth 9. Newer majors required a project ID unavailable with that configuration, even though signing an upload URL and uploading directly still succeeded.

**How to apply:** Do not treat a successful presigned upload as proof that the API can validate or serve its object. Verify both server-side metadata access and image download, without replacing managed credentials or inventing project IDs.
