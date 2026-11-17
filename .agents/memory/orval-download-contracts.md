---
name: Preview and download API contracts
description: Why binary previews and downloads use separate routes in this workspace.
---

Keep binary file previews and downloads as separate endpoint paths, rather than one operation with a download query parameter.

**Why:** The current Orval configuration generated colliding `*Params` exports when one file operation combined UUID path parameters with the download query parameter. Generation itself succeeded but the generated Zod package failed to compile. Distinct operations for preview and download avoided the collision without editing generated files.

**How to apply:** Extend the OpenAPI source, regenerate, and check the generated library build. Never fix this class of error by hand-editing generated output; retain separate preview/download contracts when extending client attachments.
