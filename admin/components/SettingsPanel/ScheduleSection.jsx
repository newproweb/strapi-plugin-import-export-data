import React from "react";

import {
  Box, Flex, Button, Typography, Field, TextInput, NumberInput, Switch, SingleSelect, SingleSelectOption,
} from "@strapi/design-system";
import { Calendar } from "@strapi/icons";

import { CRON_PRESETS } from "../../constants/export";
import HintTooltip from "../HintTooltip";
import SectionHeading from "../SectionHeading";

const DEFAULT_CRON = "0 2 * * *";
const VALID_MODES = ["full", "db-only", "off"];

const HINTS = {
  cron: "Standard 5-field cron. An empty value disables auto-backups.",
  retention: "Older auto-backups are pruned after each scheduled run.",
  excludeFiles: "Skips uploaded files — produces a faster, smaller archive.",
  adoptOrphans:
    "Inserts one plugin::upload.file row per orphan file before export so strapi export bundles them. "
    + "The rows are permanent — they stay in the DB and appear in the Media Library.",
  preRestore:
    "Before every restore the plugin exports a pre-restore-*.tar.gz so a bad import can be rolled back. "
    + "Full includes media (assets recoverable too); DB-only skips assets for a faster snapshot but leaves "
    + "new media files on disk if the restore fails.",
};

const readMode = (raw) => {
  if (raw === true) return "full";
  if (raw === false) return "off";
  return VALID_MODES.includes(raw) ? raw : "full";
};

const ScheduleToggle = ({ enabled, onToggle }) => (
  <Button size="S" variant={enabled ? "success-light" : "danger-light"} onClick={onToggle}>
    {enabled ? "Enabled" : "Disabled"}
  </Button>
);

const ScheduleSection = ({ cfg, onField }) => {
  const enabled = Boolean(cfg.backupSchedule && String(cfg.backupSchedule).trim());
  const toggle = () => onField("backupSchedule", enabled ? "" : DEFAULT_CRON);

  return (
    <Box borderColor="neutral200" padding={5} hasRadius shadow="filterShadow" marginBottom={4}>
      <Box paddingBottom={4}>
        <SectionHeading
          icon={<Calendar width="1.5rem" height="1.5rem" />}
          title="Auto-Backup Schedule"
          subtitle="Configure automatic backups on a cron schedule."
        />
      </Box>
      <Flex direction="column" gap={4} alignItems="stretch">
        <Field.Root>
          <Field.Label marginBottom={2}>Cron expression</Field.Label>
          <TextInput
            value={cfg.backupSchedule || ""}
            onChange={(e) => onField("backupSchedule", e.target.value)}
            placeholder="e.g. 0 2 * * *  (empty = disabled)"
            endAction={<HintTooltip label={HINTS.cron} ariaLabel="Cron help" />}
          />
          <Flex gap={2} paddingTop={2} wrap="wrap" marginTop={2}>
            {CRON_PRESETS.map((p) => (
              <Button key={p.value} size="S" variant="tertiary" onClick={() => onField("backupSchedule", p.value)}>
                {p.label}
              </Button>
            ))}
            <ScheduleToggle enabled={enabled} onToggle={toggle} />
          </Flex>
        </Field.Root>

        <Field.Root>
          <Field.Label marginBottom={2} action={<HintTooltip label={HINTS.retention} ariaLabel="Retention help" />}>
            Retention (keep newest N)
          </Field.Label>
          <NumberInput
            value={Number(cfg.retention) || 10}
            onValueChange={(v) => onField("retention", v)}
            minimum={1}
            maximum={500}
          />
        </Field.Root>

        <Flex gap={2} alignItems="center">
          <Switch
            checked={Boolean(cfg.autoExcludeFiles)}
            onCheckedChange={(v) => onField("autoExcludeFiles", Boolean(v))}
            aria-label="Exclude uploaded files from auto-backups"
          />
          <Typography>Exclude uploaded files from auto-backups</Typography>
          <HintTooltip label={HINTS.excludeFiles} ariaLabel="Exclude files help" />
        </Flex>

        <Flex gap={2} alignItems="center">
          <Switch
            checked={Boolean(cfg.adoptOrphans)}
            onCheckedChange={(v) => onField("adoptOrphans", Boolean(v))}
            aria-label="Adopt orphan upload files before export"
          />
          <Typography>Adopt orphan upload files before export</Typography>
          <HintTooltip label={HINTS.adoptOrphans} ariaLabel="Adopt orphans help" />
        </Flex>

        <Field.Root>
          <Field.Label marginBottom={2} action={<HintTooltip label={HINTS.preRestore} ariaLabel="Pre-restore snapshot help" />}>
            Pre-restore snapshot
          </Field.Label>
          <SingleSelect
            value={readMode(cfg.preRestoreSnapshot)}
            onChange={(v) => onField("preRestoreSnapshot", v)}
          >
            <SingleSelectOption value="full">Full snapshot (DB + media) — safest</SingleSelectOption>
            <SingleSelectOption value="db-only">DB-only — faster, rollback covers data only</SingleSelectOption>
            <SingleSelectOption value="off">Off — no auto-snapshot (NOT recommended)</SingleSelectOption>
          </SingleSelect>
        </Field.Root>
      </Flex>
    </Box>
  );
};

export default ScheduleSection;
