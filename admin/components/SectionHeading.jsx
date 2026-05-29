import React from "react";

import { Flex, Typography } from "@strapi/design-system";

import HintTooltip from "./HintTooltip";

const TONES = {
  primary: { background: "primary100", textColor: "primary600" },
  success: { background: "success100", textColor: "success600" },
  warning: { background: "warning100", textColor: "warning600" },
  neutral: { background: "neutral150", textColor: "neutral600" },
};

const SectionHeading = ({ icon, title, subtitle, hint, actions, tone = "primary" }) => {
  const palette = TONES[tone] || TONES.primary;

  const renderText = () => (
    <Flex direction="column" gap={1} alignItems="flex-start" flex="1" minWidth="12rem">
      <Flex gap={2} alignItems="center">
        <Typography variant="delta">{title}</Typography>
        {hint && <HintTooltip label={hint} ariaLabel={`About ${title}`} />}
      </Flex>
      {subtitle && (
        <Typography variant="pi" textColor="neutral600">{subtitle}</Typography>
      )}
    </Flex>
  );

  return (
    <Flex justifyContent="space-between" alignItems="center" gap={3} wrap="wrap">
      <Flex gap={3} alignItems="center" flex="1" minWidth="12rem">
        {icon && (
          <Flex background={palette.background} textColor={palette.textColor} hasRadius padding={2} aria-hidden="true">
            {icon}
          </Flex>
        )}
        {renderText()}
      </Flex>
      {actions && <Flex gap={2} wrap="wrap">{actions}</Flex>}
    </Flex>
  );
};

export default SectionHeading;
