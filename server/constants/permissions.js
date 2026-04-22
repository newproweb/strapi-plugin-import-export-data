"use strict";

const ACTION_HANDLERS = {
  read: (checker) => checker.can.read(),
  create: (checker) => checker.can.create(),
  update: (checker) => checker.can.update(),
  delete: (checker) => checker.can.delete(),
};

module.exports = { ACTION_HANDLERS };
