"use strict";

const routes = require("./routes");
const config = require("./config");
const services = require("./services");
const controllers = require("./controllers");

const PLUGIN = "import-export-data";

module.exports = {
  routes,
  config,
  services,
  controllers,

  async bootstrap({ strapi }) {
    try {
      await strapi.plugin(PLUGIN).service("scheduleService").register();
    } catch (error) {
      strapi.log.error(`[import-export] bootstrap schedule failed: ${error.message}`);
    }
  },
};
