import React from "react";

import { Dialog, Flex, Button, Typography, SingleSelect, SingleSelectOption, Loader } from "@strapi/design-system";

const DeleteBody = ({ file }) => (
  <Typography>
    The file <code>{file}</code> will be permanently deleted.
  </Typography>
);

const RestoreRunning = () => (
  <Flex direction="column" alignItems="center" gap={4} paddingTop={2} paddingBottom={2}>
    <Loader>Running `strapi import --force`…</Loader>
    <Typography textAlign="center" textColor="neutral600">
      The database and uploads directory are being replaced. Keep this window open.
    </Typography>
  </Flex>
);

const SCOPE_HINT = {
  full: "Imports the database and the uploads/assets folder.",
  db: "Imports only the database — uploads are left untouched. Fastest path; run a Files-only restore afterwards if you also need the assets.",
  files: "Imports only the uploads/assets — the database is left untouched.",
};

const RestoreForm = ({ file, scope, onScope }) => (
  <Flex direction="column" gap={3} alignItems="stretch">
    <Typography>
      Runs <code>strapi import</code> on <code>{file}</code>. It will <strong>overwrite</strong> the selected data.
    </Typography>
    <SingleSelect label="What to restore" value={scope} onChange={(v) => onScope(String(v))}>
      <SingleSelectOption value="full">Full — database + files</SingleSelectOption>
      <SingleSelectOption value="db">Database only (fast)</SingleSelectOption>
      {/* <SingleSelectOption value="files">Files only</SingleSelectOption> */}
    </SingleSelect>
    <Typography variant="pi" textColor="neutral600">{SCOPE_HINT[scope]}</Typography>
    <Typography variant="pi" textColor="success700">
      Your admin session, API tokens and user accounts are snapshotted before the CLI runs and replayed afterwards, so you stay signed in — no re-login needed.
    </Typography>
    <Typography textColor="warning600">Restart Strapi after the restore finishes.</Typography>
  </Flex>
);

const ConfirmDialog = ({
  confirm, working, restoreScope, onClose, onScope, onConfirm,
}) => {
  if (!confirm) return null;

  const isUploadImport = confirm.type === "upload-import";
  const isRestore = confirm.type === "restore";
  const isImportLike = isRestore || isUploadImport;
  const title = isUploadImport
    ? "Import uploaded archive?"
    : isRestore ? "Restore backup?" : "Delete backup?";

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Content>
        <Dialog.Header>{title}</Dialog.Header>
        <Dialog.Body>
          {isImportLike && working && <RestoreRunning />}
          {isImportLike && !working && (
            <RestoreForm file={confirm.file} scope={restoreScope} onScope={onScope} />
          )}
          {!isImportLike && <DeleteBody file={confirm.file} />}
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button variant="tertiary">Cancel</Button>
          </Dialog.Cancel>
          <Dialog.Action>
            <Button
              variant={isImportLike ? "default" : "danger-light"}
              loading={working}
              onClick={() => onConfirm(confirm)}
            >
              {isUploadImport ? "Import" : isRestore ? "Restore" : "Delete"}
            </Button>
          </Dialog.Action>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default ConfirmDialog;
