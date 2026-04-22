import React from "react";

import { Dialog, Box, Flex, Button, Typography, Checkbox, Loader } from "@strapi/design-system";

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

const RestoreForm = ({ file, excludeFiles, onToggleExclude }) => (
  <Flex direction="column" gap={3}>
    <Typography>
      Runs <code>strapi import --file {file} --force{excludeFiles ? " --exclude files" : ""}</code>.
      It will <strong>overwrite</strong> the current database
      {excludeFiles ? " (uploads folder preserved)" : " and uploads"}.
    </Typography>
    <Checkbox checked={excludeFiles} onCheckedChange={(v) => onToggleExclude(Boolean(v))}>
      Exclude files (keep existing uploads folder)
    </Checkbox>
    <Typography variant="pi" textColor="neutral600">
      Tick this if the backup was created with <code>--exclude files</code>
      {" "}(no <code>assets/</code> inside the archive), or when restoring to an environment whose media must not be touched.
      Without it, Strapi will wipe <code>public/uploads/</code> and — on cloud storage — may permanently delete the remote assets.
    </Typography>
    <Typography variant="pi" textColor="success700">
      Your admin session, API tokens and user accounts are snapshotted before the CLI runs and replayed afterwards, so you stay signed in — no re-login needed.
    </Typography>
    <Typography textColor="warning600">Restart Strapi after the restore finishes.</Typography>
  </Flex>
);

const ConfirmDialog = ({
  confirm, working, restoreExcludeFiles, onClose, onToggleExclude, onConfirm,
}) => {
  if (!confirm) return null;

  const isRestore = confirm.type === "restore";
  const title = isRestore ? "Restore backup?" : "Delete backup?";

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Content>
        <Dialog.Header>{title}</Dialog.Header>
        <Dialog.Body>
          {isRestore && working && <RestoreRunning />}
          {isRestore && !working && (
            <RestoreForm
              file={confirm.file}
              excludeFiles={restoreExcludeFiles}
              onToggleExclude={onToggleExclude}
            />
          )}
          {!isRestore && <DeleteBody file={confirm.file} />}
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button variant="tertiary">Cancel</Button>
          </Dialog.Cancel>
          <Dialog.Action>
            <Button
              variant={isRestore ? "default" : "danger-light"}
              loading={working}
              onClick={() => onConfirm(confirm)}
            >
              {isRestore ? "Restore" : "Delete"}
            </Button>
          </Dialog.Action>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default ConfirmDialog;
