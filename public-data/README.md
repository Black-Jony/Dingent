# Public Configuration Templates

`db/dingent.sqlite` is the independently sanitized, empty-account configuration
template, not the developer's live database. Its approved SHA-256 is
`1b4faa60ade22db65a149b8774dccb30480b5617f699a1fc349edbe93236854f`.

It retains six assistants, 24 plugin definitions, five workflows and two model
templates. Real accounts, password hashes, membership links, encrypted model
keys, plugin connection settings and custom model endpoints were removed.
Configuration IDs and workspace names were replaced. Guest access is disabled.
`public-demo-1` and `public-demo-2` are template workspace slugs.

For a new local environment only, copy the database to your private
`<DINGENT_HOME>/db/dingent.sqlite` before startup. Do not run against the copy in
this repository or overwrite an existing production database. Create your own
account, explicitly provision template-workspace membership, and supply your own
model keys, endpoints and plugin connections. No shared/default login is supplied.
Registration creates a separate personal workspace, not automatic membership in
the template workspaces. Plugin executables/scientific datasets are not included.

This fixed template is not automatically regenerated from any development or
production database. Changing it requires a separate sanitization review and a
deliberate update of the approved hash in `.publish/publish.py`. Ordinary source
synchronization does not replace it. The validation report describes database
checks and ORM reading, not a complete production/plugin deployment test.
