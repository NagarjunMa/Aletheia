# Chrome Web Store submission checklist

Use this checklist for the next 1.0.10 submission. The source version has been reserved for the Phthalo visual-system release; do not upload a ZIP until it is built from a clean commit.

## Store listing

- Use the product name: `Aletheia - Review-First Professional Drafts`.
- Use this description: `Draft professional introductions and application answers from context you choose. Review and edit every result before use.`
- Remove stale references to “LinkedIn Message Generator”, “cold emails”, and “AI fingerprints”.
- Replace every Store screenshot with one from the current review-first extension interface, including the first-use consent screen where appropriate.

## Privacy practices

- The 1.0.10 extension does not transmit `profileUrl`, but it checks the active supported-page URL locally to decide whether its profile-reading and fill features can run. Declare Web history conservatively and explain in the privacy policy that the URL is not retained or transmitted.
- Confirm the in-extension disclosure, Continue / Not now controls, privacy-policy link, and Settings withdrawal control in the submitted build.
- Confirm `contextMenus` is absent from the submitted manifest and permission form.

## Release verification

- Upload `ascendia-extension/dist/aletheia-extension.zip` and retain its adjacent `.version.json` checksum record.
- Confirm the artifact reports version `1.0.10` and a Git source without the `-dirty` suffix.
- Configure `NEXT_PUBLIC_CHROME_WEB_STORE_URL` in production to `https://chromewebstore.google.com/detail/pneenlhefkghefjpaafgllkjkpfjnkgg` and redeploy before publication. The application now also uses that URL as its safe fallback.
- Update `CHROME_WEB_STORE_PUBLISHED_VERSION` only after Chrome approves and publishes 1.0.10.
