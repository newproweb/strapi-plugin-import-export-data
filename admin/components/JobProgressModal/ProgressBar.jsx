import React from "react";

import { Box } from "@strapi/design-system";

const ProgressBar = ({ percent, indeterminate }) => (
  <Box
    background="neutral150"
    hasRadius
    style={{ width: "100%", height: 10, overflow: "hidden", position: "relative" }}
  >
    <Box
      background="primary600"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: indeterminate ? "35%" : `${Math.min(100, Math.max(0, percent || 0))}%`,
        transition: "width 300ms ease-out",
        animation: indeterminate ? "ie-indeterminate 1.4s linear infinite" : undefined,
      }}
    />
    <style>{`
      @keyframes ie-indeterminate {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(300%); }
      }
    `}</style>
  </Box>
);

export default ProgressBar;
