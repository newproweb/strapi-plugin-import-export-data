import React, { useEffect, useState } from "react";

import { Box, Flex, Button, Typography } from "@strapi/design-system";
import { Download, Clock } from "@strapi/icons";

import { getSchedule } from "../../utils/api";
import { CRON_PRESETS } from "../../constants/export";

const scheduleLabel = (cron) => {
  if (!cron || !String(cron).trim()) return "";
  const preset = CRON_PRESETS.find((p) => p.value === cron);
  return preset ? preset.label : cron;
};

const ExportCard = ({ onOpen }) => {
  const [schedule, setSchedule] = useState(null);

  useEffect(() => {
    getSchedule()
      .then((cfg) => setSchedule({ label: scheduleLabel(cfg?.backupSchedule) }))
      .catch(() => setSchedule(null));
  }, []);

  const renderSchedule = () => {
    if (!schedule) return null;
    return (
      <Flex gap={1} alignItems="center" textColor="neutral500">
        <Clock aria-hidden width="0.875rem" height="0.875rem" />
        <Typography variant="pi" textColor="neutral500">
          {schedule.label ? `Next scheduled backup: ${schedule.label}` : "Auto-backup disabled"}
        </Typography>
      </Flex>
    );
  };

  return (
    <Box flex="1" minWidth="280px" borderColor="neutral200" background="neutral0" padding={5} hasRadius shadow="filterShadow">
      <Flex direction="column" gap={4} alignItems="center" justifyContent="space-between" height="100%">
        <Flex direction="column" gap={3} alignItems="center">
          <Flex background="primary100" textColor="primary600" hasRadius padding={3} aria-hidden="true">
            <Download width="1.75rem" height="1.75rem" />
          </Flex>
          <Typography variant="delta">Export database</Typography>
          <Typography variant="pi" textColor="neutral600" textAlign="center">
            Runs <code>strapi export</code>. Auto-backups use the <code>backup-</code> prefix and run on the cron schedule.
          </Typography>
        </Flex>
        <Flex direction="column" gap={2} alignItems="center">
          <Button startIcon={<Download />} onClick={onOpen}>Export</Button>
          {renderSchedule()}
        </Flex>
      </Flex>
    </Box>
  );
};

export default ExportCard;
