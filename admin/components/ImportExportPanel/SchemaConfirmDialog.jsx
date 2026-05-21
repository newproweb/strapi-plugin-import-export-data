import React from "react";

import { Dialog, Box, Flex, Button, Typography } from "@strapi/design-system";

const UidGroup = ({ title, uids, textColor }) => {
  if (!uids || uids.length === 0) return null;
  return (
    <Flex direction="column" gap={1} alignItems="stretch">
      <Typography variant="sigma" textColor={textColor}>
        {title} ({uids.length})
      </Typography>
      <Box padding={2} background="neutral100" hasRadius>
        <div style={{ maxHeight: "150px", overflowY: "auto" }}>
          {uids.map((uid) => (
            <Typography key={uid} tag="div" variant="pi">{uid}</Typography>
          ))}
        </div>
      </Box>
    </Flex>
  );
};

const SchemaConfirmDialog = ({ confirm, working, onClose, onConfirm }) => {
  if (!confirm) return null;
  const { onlyInArchive = [], onlyInDestination = [] } = confirm.diff || {};

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Content>
        <Dialog.Header>Schema differences detected</Dialog.Header>
        <Dialog.Body>
          <Flex direction="column" gap={3} alignItems="stretch">
            <Typography>
              <code>{confirm.file}</code> was exported from a project whose schema
              differs from this one. Continuing imports it anyway — any data for
              types that do not exist here <strong>will be lost</strong>.
            </Typography>
            <UidGroup
              title="In archive, missing here — data will be lost"
              uids={onlyInArchive}
              textColor="danger600"
            />
            <UidGroup
              title="Here, missing in archive"
              uids={onlyInDestination}
              textColor="warning600"
            />
            <Typography textColor="warning600">
              Restart Strapi after the restore finishes.
            </Typography>
          </Flex>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button variant="tertiary">Cancel</Button>
          </Dialog.Cancel>
          <Dialog.Action>
            <Button variant="default" loading={working} onClick={onConfirm}>
              Continue import
            </Button>
          </Dialog.Action>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default SchemaConfirmDialog;
