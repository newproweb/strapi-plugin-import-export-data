import React from "react";

import { Tooltip } from "@strapi/design-system";
import { Information } from "@strapi/icons";

const TRIGGER_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "help",
  lineHeight: 0,
};

const HintTooltip = ({ label, ariaLabel = "More information" }) => (
  <Tooltip label={label}>
    <button type="button" aria-label={ariaLabel} style={TRIGGER_STYLE}>
      <Information aria-hidden width="1.6rem" height="1.6rem" fill="neutral500" />
    </button>
  </Tooltip>
);

export default HintTooltip;
