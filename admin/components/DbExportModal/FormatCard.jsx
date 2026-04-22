import React from "react";

import { Box, Flex, Typography } from "@strapi/design-system";
import { Lock, File } from "@strapi/icons";

import { TONE_COLORS } from "../../constants/export";

const FormatCard = ({ fmt, isActive, working, onSelect }) => {
  const tone = TONE_COLORS[fmt.tone];
  const style = {
    flex: "1 1 45%",
    minWidth: 160,
    cursor: working ? "wait" : "pointer",
    opacity: working && !isActive ? 0.5 : 1,
  };

  return (
    <Box
      background={tone.bg}
      borderColor={isActive ? "primary600" : tone.border}
      borderStyle="solid"
      borderWidth="2px"
      hasRadius
      padding={4}
      style={style}
      onClick={() => { if (!working) onSelect(fmt); }}
    >
      <Flex direction="column" gap={1}>
        <Flex gap={2} alignItems="center">
          {fmt.encrypt ? <Lock /> : <File />}
          <Typography fontWeight="bold" textColor={tone.text}>{fmt.label}</Typography>
        </Flex>
        <Typography variant="pi" textColor={tone.text}>{fmt.hint}</Typography>
      </Flex>
    </Box>
  );
};

export default FormatCard;
