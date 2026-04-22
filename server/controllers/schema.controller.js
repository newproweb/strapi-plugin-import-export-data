"use strict";

const { service } = require("../helpers/plugin-services");

const schemaSvc = () => service("schemaService");

const fetchLocales = async () => {
  const i18n = strapi.plugin("i18n");
  if (!i18n) return [];
  const locales = await i18n.service("locales").find();
  return locales || [];
};

module.exports = ({ strapi }) => ({
  async listCollections(ctx) {
    try {
      ctx.body = { data: schemaSvc().listCollections() };
    } catch (error) {
      strapi.log.error("[import-export:schema.listCollections]", error);
      ctx.throw(500, error.message || "Failed to list collections");
    }
  },

  async getCollection(ctx) {
    const { uid } = ctx.params;
    if (!uid) return ctx.throw(400, "uid is required");

    try {
      const collection = schemaSvc().getCollection(uid);
      if (!collection) return ctx.throw(404, `Collection ${uid} not found`);
      ctx.body = { data: collection };
    } catch (error) {
      strapi.log.error("[import-export:schema.getCollection]", error);
      ctx.throw(500, error.message || "Failed to get collection");
    }
  },

  async getLocales(ctx) {
    try {
      ctx.body = { data: await fetchLocales() };
    } catch (error) {
      strapi.log.error("[import-export:schema.getLocales]", error);
      ctx.body = { data: [] };
    }
  },
});
