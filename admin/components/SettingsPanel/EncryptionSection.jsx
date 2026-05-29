import React from "react";

import { Box, Field, TextInput } from "@strapi/design-system";
import { Shield, Lock } from "@strapi/icons";

import HintTooltip from "../HintTooltip";
import SectionHeading from "../SectionHeading";

const KEY_HINT =
  "When set, scheduled auto-backups run encrypted (.tar.gz.enc) and you need this same key to restore. "
  + "Strapi never stores the key anywhere else — losing it means losing access to encrypted archives.";

const EncryptionSection = ({ cfg, onField }) => {
  const placeholder = cfg.encryptionKeySet
    ? "(stored — leave as-is to keep)"
    : "leave empty for --no-encrypt";

  return (
    <Box borderColor="neutral200" padding={5} hasRadius shadow="filterShadow" marginBottom={4}>
      <Box paddingBottom={4}>
        <SectionHeading
          icon={<Shield width="1.5rem" height="1.5rem" />}
          title="Security & Encryption"
          subtitle="Encrypt scheduled backups with a key only you hold."
        />
      </Box>
      <Field.Root>
        <Field.Label marginBottom={2}>Encryption key (optional)</Field.Label>
        <TextInput
          type="password"
          value={cfg.encryptionKey || ""}
          onChange={(e) => onField("encryptionKey", e.target.value)}
          placeholder={placeholder}
          startAction={<Lock aria-hidden width="1rem" height="1rem" fill="neutral500" />}
          endAction={<HintTooltip label={KEY_HINT} ariaLabel="Encryption key help" />}
        />
      </Field.Root>
    </Box>
  );
};

export default EncryptionSection;
