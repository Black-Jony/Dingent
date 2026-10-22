# Interface translations

English in `en.json` is the source for all seven UI languages. The
`.i18n-lock.json` file records which English text each reviewed translation
corresponds to; it does **not** verify meaning.

When English text changes:

1. Update the same key in every locale JSON file. You may translate manually
   without installing a translation service. `bun run i18n:sync` is an
   optional draft generator that requires
   `I18N_TRANSLATION_API_BASE` and `I18N_TRANSLATION_MODEL`.
2. Review translations with speakers of the target languages, especially
   sign-in/out, deletion, saving, access control, and errors. Check ICU
   variables and test the rendered UI. Generated drafts are not approved.
3. After review, run `bun run i18n:approve -- --reviewed` from `ui`,
   then `bun run i18n:check` and `bun run test`.

The initial four added locale catalogs were generated with an offline
translator and then selectively corrected. No offline translation engine is
required by the app or for manual updates. A complete native-speaker review
of all messages is still required before public release.
