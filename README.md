# Import Export Data

A **Strapi 5** plugin that wraps the official `strapi export` / `strapi import` CLI
in an admin UI and adds per-collection CSV/JSON/XLSX export plus scheduled,
retention-aware auto-backups.

- **Version:** `5.0.0`
- **Strapi:** `^5.0.0`

---

## Features

- **Create / restore / download / delete** full project archives (`tar`, `tar.gz`,
  `tar.enc`, `tar.gz.enc`) from the admin.
- **Import** an archive from another project by drag-and-drop.
- **Per-collection export** in the Content Manager list view
  (Quick export in CSV/JSON/XLSX or Data Explorer with column picker & filters).
- **Per-collection import** of CSV/JSON/XLSX from the same list view.
- **Scheduled auto-backups** via cron, with retention, optional encryption key
  and an option to exclude uploaded files.
- **One-click "Run now"** to trigger the scheduled backup immediately.
- Live job-progress log for every export / import / restore.
- Auth state is preserved across restores — you do not get logged out.

---

## Install

```bash
npm install import-export-data
# or
yarn add import-export-data
```

Enable it in `config/plugins.js`:

```js
module.exports = () => ({
  "import-export-data": { enabled: true },
});
```

### Raise the body-size limit (IMPORTANT for uploads)

Archives are uploaded via multipart. There are **two independent** layers that
can reject a large upload with `413 Payload Too Large`. Both must be raised or
the UI will show `Unexpected token '<', "<html> <h"... is not valid JSON`:

#### 1. Strapi — `admin/config/middlewares.js`

Replace the bare `"strapi::body"` entry with an object form:

```js
module.exports = [
  "strapi::errors",
  "strapi::poweredBy",
  "strapi::logger",
  "strapi::query",
  {
    name: "strapi::body",
    config: {
      jsonLimit: "512mb",
      formLimit: "512mb",
      textLimit: "512mb",
      formidable: { maxFileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB
    },
  },
  "strapi::session",
  // ...rest
];
```

Restart Strapi after the change — config is read only at boot.

#### 2. Reverse proxy (nginx / traefik / Cloudflare)

If any proxy sits in front of Strapi, raise its body-size limit too — it will
reject the upload **before** it reaches Strapi, so Strapi logs stay empty and
only the browser sees the HTML 413 from the proxy.

**nginx** — inside each `http { ... }` block (all configs in `proxy/`):

```nginx
client_max_body_size 2g;
client_body_buffer_size 1m;
proxy_request_buffering off;     # stream the upload; don't buffer the whole body in RAM
proxy_read_timeout 1800s;        # 30 min for very large archives
proxy_send_timeout 1800s;
```

Restart the nginx container (`docker compose restart proxy`) after the change.

**traefik** — set `buffering.maxRequestBodyBytes` on the router middleware.

**Cloudflare** — the free plan hard-caps uploads at 100 MB. Upgrade or bypass
Cloudflare for the admin subdomain if your archives exceed it.

#### Troubleshooting

| Symptom                                          | Layer to fix                       |
| ------------------------------------------------ | ---------------------------------- |
| Browser shows `Unexpected token '<'`, no log     | Check nginx/proxy `413` response   |
| Strapi log shows `PayloadTooLargeError`          | Raise `strapi::body` limits        |
| Upload hangs and times out                       | Raise `proxy_read_timeout` in nginx |
| Works locally, fails via proxy only              | Proxy `client_max_body_size` too low |

**Rule of thumb:** proxy limit must be **≥** Strapi `formidable.maxFileSize`.
Match them in both places — if you raise one and not the other, the lower wins.

### Ignore backups from the admin watcher

Backups are written to `data/backups/`. Without an ignore rule the Strapi admin
dev server restarts every time a new archive lands. Add the following to
**`admin/config/admin.js`**:

```js
module.exports = ({ env }) => ({
  // ...your existing admin config
  watchIgnoreFiles: [
    "**/data/backups/**",
    "**/data/*.tar",
    "**/data/*.tar.gz",
    "**/data/*.tar.enc",
    "**/data/*.tar.gz.enc",
    "**/.plugin-config.json",
  ],
});
```

---

## UI

### Home page — Import / Export tab

Create an export, drop an archive to import, and manage existing backups
from one table.

![Home page](./docs/home.png)

### Export modal

Pick an archive format, optionally supply an encryption key, and exclude
any part (`files`, `config`, `content`) via the CLI flag.

![Export modal](./docs/export.png)

### Settings tab

Configure the cron schedule, retention, encryption key and auto-exclude
option. The **Enabled / Disabled** pill next to the cron presets is green
when the schedule is active and red when it is off — one click toggles it.

![Settings tab](./docs/settings.png)

---

## Production safety

This plugin wipes and replaces the DB on import/restore, so every risky
operation has a built-in safeguard. Most of these you do **not** need to
touch — they run automatically once you restart Strapi after the upgrade.

### 1. Concurrent-job mutex

Only one export / import / restore can run at a time. While any job is
running, the UI disables the **Import & seed** and **Save only** buttons
and shows a banner identifying the running job. The server also returns
`409 Conflict` if a second job is started via the API.

### 2. Archive validation

Every archive is validated before import:

- existence + extension whitelist (`.tar`, `.tar.gz`, `.tar.enc`, `.tar.gz.enc`)
- minimum size (≥ 1 KB — rejects truncated / empty uploads)
- `tar -t` integrity check on non-encrypted archives (corrupt or
  path-traversal archives fail here)

### 3. Pre-restore auto-snapshot

Before **every** import/restore, the plugin first creates a
`pre-restore-<timestamp>.tar.gz` archive. If the imported archive turns
out to be bad, open the **Import / Export** tab and restore the
`pre-restore-*` entry to roll back.

You can disable this in **Settings → Auto-snapshot before restore** if
you accept the risk. Kept **on** by default.

### 4. Orphan-adopt is opt-in

Strapi CLI only bundles files that have a `plugin::upload.file` row.
If you have uploads on disk that were put there manually (e.g. a Docker
volume copy), turn on **Settings → Adopt orphan uploads before export**.

The orphan rows are **permanent** — they stay in the DB after export and
will appear in the Media Library. For that reason the option is **off by
default**.

### 5. Body-size pre-check

The UI fetches the server's configured `formidable.maxFileSize` on load
and disables the import buttons if the dropped archive exceeds it,
showing a clear message instead of the generic HTML-413 error. See
[Raise the body-size limit](#raise-the-body-size-limit-important-for-uploads)
to raise the limit at both the Strapi and the reverse-proxy layers.

### 6. Pad-placeholder crash recovery

During export the plugin writes 0-byte placeholders for missing upload
files (so the CLI does not crash on `ENOENT`). If the Strapi process is
killed mid-export (`SIGKILL`, OOM, container restart), these empty files
would normally stay on disk and corrupt the Media Library. The plugin
tracks them in `data/backups/.pending-pad.json` and cleans them up on
next boot.

### 7. Upload-hash collisions

Orphan-adopt now assigns each row a Strapi-style
`<basename>_<random10>` hash to avoid hitting the unique constraint on
`upload_files.hash` when two files on disk happen to share a basename.

---

## Storage

Archives live under `<strapi-root>/data/backups/`. Plugin settings are
persisted in `<strapi-root>/data/backups/.plugin-config.json`.

Add `data/backups/` to `.gitignore`.

---

## Permissions (Role-Based ACL)

Every route and every UI entry point is gated by a dedicated plugin
action. Assign them in **Settings → Administration Panel → Roles →
\<role\> → Plugins → Import Export Data**. Users without the required
action **do not see** the corresponding UI at all — the settings link,
the tabs inside the plugin, and the per-collection Import / Export
buttons in the Content Manager all disappear.

| Action UID                                     | Grants                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `plugin::import-export-data.read`              | Open the plugin page, list backups, view job status                  |
| `plugin::import-export-data.create`            | Create a new backup / run the schedule now                           |
| `plugin::import-export-data.restore`           | **Destructive** — restore an archive, upload a new archive           |
| `plugin::import-export-data.delete`            | Delete an archive from the list                                      |
| `plugin::import-export-data.download`          | Download an archive to the local machine                             |
| `plugin::import-export-data.settings`          | View/save the schedule, encryption key, retention and safety toggles |
| `plugin::import-export-data.collection.export` | Show the **Export** menu in the Content Manager list view            |
| `plugin::import-export-data.collection.import` | Show the **Import** button in the Content Manager list view          |

Per-collection export/import additionally reuses the Content Manager's
own permission checker, so the user must still have `read` (for export)
or `create` / `update` (for import) on the target content type.

### Suggested role presets

- **Viewer** — `read` only. Can open the plugin and see what exists.
- **Operator** — `read`, `create`, `download`, `collection.export`,
  `collection.import`. Can back up and move data around but cannot
  restore or delete.
- **Admin** — all eight actions.

Newly-introduced actions must be registered with Strapi before they
appear in the role editor. The plugin does this automatically in its
`register` lifecycle on every boot, so no manual step is required after
upgrading.

---

## License

MIT
