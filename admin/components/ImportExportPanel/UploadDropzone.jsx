import React from "react";

import { Box, Flex, Button, Typography, Field, TextInput } from "@strapi/design-system";
import { Upload } from "@strapi/icons";

const UploadDropzone = ({
  file,
  encryptionKey,
  dragOver,
  working,
  onFile,
  onKey,
  onDragOver,
  onDragLeave,
  onDrop,
  onStage,
  onImport,
}) => {
  const isEncrypted = file?.name?.endsWith(".enc");

  return (
    <Box
      flex="1"
      minWidth="280px"
      background={dragOver ? "primary100" : "neutral0"}
      borderStyle="dashed"
      borderWidth="2px"
      borderColor={dragOver ? "primary500" : "neutral300"}
      padding={5}
      hasRadius
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Flex direction="column" gap={2} alignItems="center">
        <Upload width="2rem" height="2rem" />
        <Typography fontWeight="semiBold">Import database</Typography>
        <Typography textAlign="center" textColor="neutral600">
          {file
            ? `Selected: ${file.name}`
            : "Drop a .tar / .tar.gz / .tar.enc / .tar.gz.enc archive from another Strapi project and it will be seeded via strapi import."}
        </Typography>
        <label>
          <input
            type="file"
            accept=".tar,.gz,.enc"
            onChange={(e) => onFile(e.target.files?.[0] || null)}
            style={{ display: "none" }}
          />
          <Button tag="span" variant="tertiary">Browse file</Button>
        </label>

        {file && isEncrypted && (
          <Field.Root style={{ minWidth: 240 }}>
            <Field.Label>Encryption key</Field.Label>
            <TextInput
              type="password"
              value={encryptionKey}
              onChange={(e) => onKey(e.target.value)}
            />
          </Field.Root>
        )}

        {file && (
          <Flex gap={2} wrap="wrap" justifyContent="center">
            <Button variant="tertiary" onClick={onStage} disabled={working}>Save only</Button>
            <Button
              variant="default"
              startIcon={<Upload />}
              onClick={onImport}
              loading={working}
              disabled={working}
            >
              Import &amp; seed
            </Button>
          </Flex>
        )}

        {file && (
          <Typography variant="pi" textColor="warning600" textAlign="center">
            "Import &amp; seed" wipes current DB and uploads, then replays
            {" "}<code>strapi import --file … --force</code>.
          </Typography>
        )}
      </Flex>
    </Box>
  );
};

export default UploadDropzone;
