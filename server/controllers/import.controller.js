"use strict";

const { services } = require("../helpers/plugin-services");
const { pickBody, validateImportBody, buildImportOpts } = require("../helpers/import-body");

module.exports = ({ strapi }) => ({
  async importData(ctx) {
    const body = pickBody(ctx);
    validateImportBody(ctx, body);

    try {
      const { permissions, importer } = services();
      await permissions.assertAllowed(ctx, body.uid, "create");
      await permissions.assertAllowed(ctx, body.uid, "update");

      const data = await importer.importCollection(buildImportOpts(body));
      ctx.body = { data };
    } catch (error) {
      strapi.log.error("[import-export:import.importData]", error);
      ctx.throw(error.status || 500, error.message || "Import failed");
    }
  },
});
