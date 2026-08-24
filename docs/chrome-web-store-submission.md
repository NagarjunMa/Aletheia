# Chrome Web Store submission checklist

Use this checklist for the 1.0.8 submission. The ZIP is only eligible after it is built from a clean commit.

## Store listing

- Use the product name: `Aletheia - Review-First Professional Drafts`.
- Use this description: `Draft professional introductions and application answers from context you choose. Review and edit every result before use.`
- Remove stale references to “LinkedIn Message Generator”, “cold emails”, and “AI fingerprints”.
- Replace every Store screenshot with one from the current review-first extension interface, including the first-use consent screen where appropriate.

## Privacy practices

- The 1.0.8 extension does not transmit `profileUrl`. Do not declare Web history for this release unless a later change reintroduces URL transmission; declare all other data use accurately from the submitted build.
- Confirm the in-extension disclosure, Continue / Not now controls, privacy-policy link, and Settings withdrawal control in the submitted build.

## Release verification

- Upload `ascendia-extension/dist/aletheia-extension.zip` and retain its adjacent `.version.json` checksum record.
- Confirm the artifact reports version `1.0.8` and a Git source without the `-dirty` suffix.
- Configure `NEXT_PUBLIC_CHROME_WEB_STORE_URL` in production to `https://chromewebstore.google.com/detail/pneenlhefkghefjpaafgllkjkpfjnkgg` and redeploy before publication. The application now also uses that URL as its safe fallback.
- Update `CHROME_WEB_STORE_PUBLISHED_VERSION` only after Chrome approves and publishes 1.0.8.
