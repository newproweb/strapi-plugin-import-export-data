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
      </Flex>
    </Box>
  );
};

export default ScheduleSection;
