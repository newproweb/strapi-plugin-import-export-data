import React from "react";

import { Box, Flex, Typography, Field, TextInput } from "@strapi/design-system";

const EncryptionSection = ({ cfg, onField }) => {
  const placeholder = cfg.encryptionKeySet
    ? "(stored — leave as-is to keep)"
    : "leave empty for --no-encrypt";

  return (
    <Box borderColor="neutral200" padding={5} hasRadius shadow="filterShadow" marginBottom={4}>
      <Typography variant="beta" marginBottom={2}>Encryption</Typography>
      <br /><br />
      <Flex direction="column" gap={3} alignItems="stretch">
        <Field.Root>
          <Field.Label marginBottom={2}>Encryption key (optional)</Field.Label>
          <TextInput
            type="password"
            value={cfg.encryptionKey || ""}
            onChange={(e) => onField("encryptionKey", e.target.value)}
            placeholder={placeholder}
          />
          <Typography variant="pi" textColor="neutral500" marginTop={1}>
            When set, scheduled auto-backups run encrypted (<code>.tar.gz.enc</code>).
            You'll need this same key to restore. Strapi does NOT save the key anywhere else — losing it means losing access to encrypted archives.
          </Typography>
        </Field.Root>
      </Flex>
    </Box>
  );
};

export default EncryptionSection;
