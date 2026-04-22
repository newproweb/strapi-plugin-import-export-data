"use strict";

const { services } = require("../helpers/plugin-services");
const { buildExportOpts, buildPreviewOpts } = require("../helpers/query-opts");
const { toBuffer } = require("../helpers/response-body");

const requireUid = (ctx, query) => {
  if (!query.uid) ctx.throw(400, "uid query parameter is required");
};

const writeDownload = (ctx, result) => {
  const body = toBuffer(result);
  ctx.set("Content-Type", result.mime);
  ctx.set("Content-Disposition", `attachment; filename="${result.filename}"`);
  ctx.set("Content-Length", String(body.length));
  ctx.body = body;
};

module.exports = ({ strapi }) => ({
  async exportData(ctx) {
    const query = ctx.request.query || {};
    requireUid(ctx, query);

    try {
      const { permissions, exporter } = services();
      await permissions.assertAllowed(ctx, query.uid, "read");
      const result = await exporter.exportCollection(buildExportOpts(query));
      writeDownload(ctx, result);
    } catch (error) {
      strapi.log.error("[import-export:export.exportData]", error);
      ctx.throw(error.status || 500, error.message || "Export failed");
    }
  },

  async preview(ctx) {
    const query = ctx.request.query || {};
    requireUid(ctx, query);

    try {
      const { permissions, exporter } = services();
      await permissions.assertAllowed(ctx, query.uid, "read");
      const data = await exporter.previewCollection(buildPreviewOpts(query));
      ctx.body = { data };
    } catch (error) {
      strapi.log.error("[import-export:export.preview]", error);
      ctx.throw(error.status || 500, error.message || "Preview failed");
    }
  },
});
