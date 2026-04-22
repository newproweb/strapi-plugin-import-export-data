"use strict";

const routes = require("./routes");
const config = require("./config");
const services = require("./services");
const controllers = require("./controllers");
const { recoverPending } = require("./helpers/pad-tracker");
const { PLUGIN_ACTIONS, PLUGIN } = require("./constants/permissions");

const registerPermissions = async ({ strapi }) => {
  const actions = Object.values(PLUGIN_ACTIONS);
  try {
    await strapi.admin.services.permission.actionProvider.registerMany(actions);
    strapi.log.info(`[import-export] registered ${actions.length} admin permission action(s)`);
  } catch (error) {
    strapi.log.error(`[import-export] permission registration failed: ${error.message}`);
  }
};

module.exports = {
  routes,
  config,
  services,
  controllers,

  async register({ strapi }) {
    await registerPermissions({ strapi });
  },

  async bootstrap({ strapi }) {
    try {
      const { scanned, removed } = recoverPending();
      if (scanned > 0) {
        strapi.log.info(`[import-export] pad recovery: removed ${removed}/${scanned} leftover placeholder file(s) from prior export crash`);
      }
    } catch (error) {
      strapi.log.warn(`[import-export] pad recovery failed: ${error.message}`);
    }

    try {
      await strapi.plugin(PLUGIN).service("scheduleService").register();
    } catch (error) {
      strapi.log.error(`[import-export] bootstrap schedule failed: ${error.message}`);
    }
  },
};
