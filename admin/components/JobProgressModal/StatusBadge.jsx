import React from "react";

import { Flex, Typography, Badge, Loader } from "@strapi/design-system";
import { Check, CrossCircle } from "@strapi/icons";

const pickLabel = ({ isError, isSuccess, transferComplete }) => {
  if (isError) return "error";
  if (isSuccess) return "success";
  if (transferComplete) return "transfer complete";
  return "running";
};

const pickColors = ({ isError, isSuccess, transferComplete }) => {
  if (isError) return { bg: "danger100", fg: "danger700" };
  if (isSuccess || transferComplete) return { bg: "success100", fg: "success700" };
  return { bg: "primary100", fg: "primary700" };
};

const StatusBadge = ({ title, isRunning, isSuccess, isError, transferComplete }) => {
  const state = { isError, isSuccess, transferComplete };
  const colors = pickColors(state);
  return (
    <Flex gap={2} alignItems="center">
      {isRunning && !transferComplete && <Loader small />}
      {(isSuccess || transferComplete) && <Check fill="#2f8f2f" />}
      {isError && <CrossCircle fill="#cc2020" />}
      <Typography variant="beta">{title}</Typography>
      <Badge backgroundColor={colors.bg} textColor={colors.fg}>{pickLabel(state)}</Badge>
    </Flex>
  );
};

export default StatusBadge;
