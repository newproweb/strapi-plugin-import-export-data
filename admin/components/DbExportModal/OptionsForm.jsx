import React from "react";

import { Box, Flex, Field, TextInput, Typography, Badge } from "@strapi/design-system";

import { BACKUP_FORMATS, BACKUP_TAGS } from "../../constants/export";
import FormatCard from "./FormatCard";

const OptionsForm = ({
  selected, setSelected, encryptionKey, setKey, exclude, setExclude, working,
}) => (
  <Box flex="1" minWidth="360px">
    <Typography variant="beta" marginBottom={2}>Database backup</Typography>
    <br /> <br />
    <Typography variant="pi" textColor="neutral500">
      Pick a file format. Encrypted formats need a key; you'll also need that same key to restore.
    </Typography>

    <Box paddingTop={4}>
      <Flex gap={3} wrap="wrap">
        {BACKUP_FORMATS.map((fmt) => (
          <FormatCard
            key={fmt.id}
            fmt={fmt}
            isActive={selected.id === fmt.id}
            working={working}
            onSelect={setSelected}
          />
        ))}
      </Flex>
    </Box>

    <Box paddingTop={4}>
      <Field.Root>
        <Field.Label marginBottom={2}>Encryption key (only for .enc formats)</Field.Label>
        <TextInput
          type="password"
          value={encryptionKey}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Required for tar.enc / tar.gz.enc"
          disabled={working}
        />
        <Typography variant="pi" textColor="neutral500">Store this safely — Strapi does not save it anywhere.</Typography>
      </Field.Root>
    </Box>

    <Box paddingTop={3}>
      <Field.Root>
        <Field.Label marginBottom={2}>Exclude (optional)</Field.Label>
        <TextInput
          value={exclude}
          onChange={(e) => setExclude(e.target.value)}
          placeholder="e.g. files,config"
          disabled={working}
        />
        <Typography variant="pi" textColor="neutral500">
          Comma-separated Strapi data types: <code>content</code>, <code>files</code>, <code>config</code>.
        </Typography>
      </Field.Root>
    </Box>

    <Flex gap={2} wrap="wrap" paddingTop={4}>
      {BACKUP_TAGS.map((t) => (
        <Badge key={t} backgroundColor="neutral150" textColor="neutral700">{t}</Badge>
      ))}
    </Flex>

    <Box paddingTop={4}>
      <Typography variant="pi" textColor="neutral500">
        Uses <code>strapi export</code> (MIT). Free self-hosted — no accounts, no premium tiers.
      </Typography>
    </Box>
  </Box>
);

export default OptionsForm;
