# TDS / SDS Analysis module — setup and security

This feature is developed on the `feat/tds-sds-analysis` branch. It is not live until the database migration and Edge Function are configured and the branch is deployed.

## Included

- Authenticated app route: `/dokuman-analiz`
- Private PDF bucket: `tds-sds-private` (15 MB per file)
- Owner-scoped document and report tables with RLS
- TDS analysis, SDS/MSDS safety summary, and two-TDS comparison
- Turkish JSON report stored in the private database
- Browser print-to-PDF and XLSX export
- Server-side OpenAI API call; the API key is never included in frontend code
- Uploaded OpenAI file objects are deleted after the analysis request finishes (best effort)

## Setup steps

1. In Supabase Dashboard, open **SQL Editor** for the existing project and run the contents of `supabase/migrations/202610260001_tds_sds_analysis.sql`.
2. In **Edge Functions**, create/deploy a function named `tds-sds-analyze` using `supabase/functions/tds-sds-analyze/index.ts`. Keep JWT verification enabled.
3. In the function's **Secrets** settings, add:
   - `OPENAI_API_KEY`: your OpenAI API key. Never add this to GitHub, frontend environment variables, or chat.
   - `APP_ORIGIN`: the exact website origin (scheme + hostname only, no path), for example `https://ugurkamak.github.io` if that is the actual deployed origin.
   Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Edge Functions.
4. Confirm the existing storage bucket `tds-sds-private` is private and that the migration's storage policies are present.
5. Deploy the app from this branch through the existing hosting workflow. Do not merge to the production branch until the build and access tests pass.
6. Sign in with an active account and open `/dokuman-analiz`.

## Important security notes

- This repository is currently public. The source code and prompts are therefore public; never commit real TDS/SDS files, API keys, credentials, signed URLs, or company-only report content.
- Uploaded PDFs remain in the private Supabase bucket and are sent to the configured OpenAI API for analysis. Review your company's policy and the provider's current data-processing/retention terms before uploading confidential documents.
- The function deletes temporary OpenAI file objects after the request, best effort. This is not a guarantee that no service-side logs or transient processing data exist.
- The report archive is protected by row-level security and tied to the signed-in user's ID. Verify RLS in the deployed Supabase project before using real documents.
- The initial version is single-user-friendly but does not hardcode one email. To restrict it to only one account, keep public sign-up disabled in Supabase Auth and create/activate only your own account. Do not rely on an unlisted URL as access control.
- The AI report is a decision-support aid, not a replacement for the manufacturer's TDS/SDS or laboratory validation. It must not invent absent data; always check source PDF pages for critical safety or specification decisions.

## Validation checklist

- [ ] Migration runs without errors.
- [ ] Unauthenticated users cannot query document/report tables or access private files.
- [ ] The signed-in user can upload and analyze a sample PDF.
- [ ] A different user cannot read the first user's storage paths, documents, or reports.
- [ ] Two-TDS comparison rejects SDS documents.
- [ ] PDF export and XLSX export work in the target browser.
- [ ] Invalid/oversized PDFs fail with a clear error.
- [ ] No API key appears in browser network requests or repository files.
