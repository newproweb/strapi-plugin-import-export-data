import React from "react";

import {
  Box, Flex, Button, Typography, Field, TextInput, NumberInput, Checkbox,
} from "@strapi/design-system";

import { CRON_PRESETS } from "../../constants/export";

const DEFAULT_CRON = "0 2 * * *";

const ScheduleToggle = ({ enabled, onToggle }) => (
  <Button
    size="S"
    variant={enabled ? "success-light" : "danger-light"}
    onClick={onToggle}
  >
    {enabled ? "Enabled" : "Disabled"}
  </Button>
);

const ScheduleSection = ({ cfg, onField }) => {
  const enabled = Boolean(cfg.backupSchedule && String(cfg.backupSchedule).trim());
  const toggle = () => onField("backupSchedule", enabled ? "" : DEFAULT_CRON);

  return (
    <Box borderColor="neutral200" padding={5} hasRadius shadow="filterShadow" marginBottom={4}>
      <Typography variant="beta" marginBottom={2}>Auto-backup schedule</Typography>
      <br /><br />
      <Flex direction="column" gap={4} alignItems="stretch">
        <Field.Root>
          <Field.Label marginBottom={2}>Cron expression</Field.Label>
          <TextInput
            value={cfg.backupSchedule || ""}
            onChange={(e) => onField("backupSchedule", e.target.value)}
            placeholder="e.g. 0 2 * * *  (empty = disabled)"
          />
          <Typography variant="pi" textColor="neutral500" marginTop={1}>Standard 5-field cron. Empty string disables auto-backups.</Typography>
          <Flex gap={2} paddingTop={2} wrap="wrap" marginTop={4}> 
            {CRON_PRESETS.map((p) => (
              <Button
                key={p.value}
                size="S"
                variant="tertiary"
                onClick={() => onField("backupSchedule", p.value)}
              >
                {p.label}
              </Button>
            ))}
            <ScheduleToggle enabled={enabled} onToggle={toggle} />
          </Flex>
        </Field.Root>

        <Field.Root>
          <Field.Label marginBottom={2}>Retention (keep newest N auto-backups)</Field.Label>
          <NumberInput
            value={Number(cfg.retention) || 10}
            onValueChange={(v) => onField("retention", v)}
            minimum={1}
            maximum={500}
          />
          <Typography variant="pi" textColor="neutral500" marginTop={1}>Older auto-backups are pruned after each scheduled run.</Typography>
        </Field.Root>

        <Checkbox
          checked={Boolean(cfg.autoExcludeFiles)}
          onCheckedChange={(v) => onField("autoExcludeFiles", Boolean(v))}
        >
          Exclude uploaded files from auto-backups (faster, smaller archive)
        </Checkbox>

        <Checkbox
          checked={Boolean(cfg.adoptOrphans)}
          onCheckedChange={(v) => onField("adoptOrphans", Boolean(v))}
        >
          Adopt orphan upload files before export (include files on disk that have no plugin::upload.file row)
        </Checkbox>
        <Typography variant="pi" textColor="neutral500">
          Off by default. Turning it on inserts one row per orphan file so <code>strapi export</code> bundles them.
          The rows are permanent — they remain in the DB after export and will appear in the Media Library.
        </Typography>

        <Checkbox
          checked={cfg.preRestoreSnapshot !== false}
          onCheckedChange={(v) => onField("preRestoreSnapshot", Boolean(v))}
        >
          Auto-snapshot before restore/import (recommended)
        </Checkbox>
        <Typography variant="pi" textColor="neutral500">
          Before every import or restore, create a <code>pre-restore-*.tar.gz</code> archive so a bad import can be rolled back.
        </Typography>
      </Flex>
    </Box>
  );
};

export default ScheduleSection;
