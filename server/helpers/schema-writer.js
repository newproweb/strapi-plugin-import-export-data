"use strict";

const fs = require("fs");
const path = require("path");

const { appRoot, backupDir } = require("../utils/fs");

const MARKER = ".pending-full-seed.json";

const pick = (obj, keys) => {
  const out = {};
  for (const key of keys) if (obj[key] !== undefined) out[key] = obj[key];
  return out;
};

// Writes a file only when it does not already exist — Full-seed never
// overwrites schema a project already defines in its own code.
const writeIfMissing = (file, content) => {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
};

/**
 * Classifies the archive's schemas into what Full-seed can recreate as `src/`
 * code (api content-types + components) and what it cannot — `plugin::` types
 * need the owning plugin installed; `admin::` types are Strapi core.
 */
const planFullSeed = (schemas, strapi) => {
  const contentTypes = strapi.contentTypes || {};
  const components = strapi.components || {};
  const ctToCreate = [];
  const compToCreate = [];
  const plugins = new Set();

  for (const schema of schemas) {
    const { uid } = schema;
    if (schema.modelType === "component") {
      if (!components[uid]) compToCreate.push(uid);
    } else if (uid.startsWith("api::")) {
      if (!contentTypes[uid]) ctToCreate.push(uid);
    } else if (uid.startsWith("plugin::")) {
      plugins.add(uid.slice("plugin::".length).split(".")[0]);
    }
  }

  return {
    contentTypesToCreate: ctToCreate.sort(),
    componentsToCreate: compToCreate.sort(),
    missingPlugins: [...plugins].sort(),
  };
};

const factoryFile = (kind, uid) =>
  `"use strict";\n\nconst { factories } = require("@strapi/strapi");\n\nmodule.exports = factories.createCore${kind}("${uid}");\n`;

// Drops relation attributes whose target content-type will not exist after
// the sync (e.g. a relation to a `plugin::` type whose plugin is not
// installed) — an unresolvable relation target makes Strapi fail to boot.
const sanitizeAttributes = (attributes, validTargets) => {
  const out = {};
  for (const [name, attr] of Object.entries(attributes || {})) {
    if (attr && attr.type === "relation" && attr.target && !validTargets.has(attr.target)) continue;
    out[name] = attr;
  }
  return out;
};

const writeApiContentType = (schema, validTargets) => {
  const rest = schema.uid.slice("api::".length);
  const dot = rest.indexOf(".");
  const apiName = rest.slice(0, dot);
  const ctName = rest.slice(dot + 1);
  const apiDir = path.join(appRoot(), "src", "api", apiName);

  const schemaJson = pick(schema, ["kind", "collectionName", "info", "options", "pluginOptions", "attributes"]);
  schemaJson.attributes = sanitizeAttributes(schema.attributes, validTargets);

  writeIfMissing(path.join(apiDir, "content-types", ctName, "schema.json"), JSON.stringify(schemaJson, null, 2));
  writeIfMissing(path.join(apiDir, "controllers", `${ctName}.js`), factoryFile("Controller", schema.uid));
  writeIfMissing(path.join(apiDir, "routes", `${ctName}.js`), factoryFile("Router", schema.uid));
  writeIfMissing(path.join(apiDir, "services", `${ctName}.js`), factoryFile("Service", schema.uid));
};

const writeComponent = (schema, validTargets) => {
  const dot = schema.uid.indexOf(".");
  const category = schema.uid.slice(0, dot);
  const name = schema.uid.slice(dot + 1);
  const json = pick(schema, ["collectionName", "info", "options", "attributes"]);
  json.attributes = sanitizeAttributes(schema.attributes, validTargets);
  writeIfMissing(
    path.join(appRoot(), "src", "components", category, `${name}.json`),
    JSON.stringify(json, null, 2),
  );
};

/**
 * Writes `src/` schema files for every api content-type and component in the
 * archive that the destination does not already have. `plugin::`/`admin::`
 * schemas are skipped (see `planFullSeed`). Returns the created uids.
 */
const writeSchemaFiles = (schemas, strapi) => {
  const contentTypes = strapi.contentTypes || {};
  const components = strapi.components || {};
  const created = { contentTypes: [], components: [] };

  // Relation targets that will resolve after the sync: every content-type
  // already on the destination (incl. core/plugin types) plus every api
  // content-type this run creates.
  const validTargets = new Set([
    ...Object.keys(contentTypes),
    ...schemas.filter((s) => s.uid.startsWith("api::")).map((s) => s.uid),
  ]);

  for (const schema of schemas) {
    const { uid } = schema;
    if (schema.modelType === "component") {
      if (components[uid]) continue;
      writeComponent(schema, validTargets);
      created.components.push(uid);
    } else if (uid.startsWith("api::") && !contentTypes[uid]) {
      writeApiContentType(schema, validTargets);
      created.contentTypes.push(uid);
    }
  }
  return created;
};

const markerPath = () => path.join(backupDir(), MARKER);

const writePendingSeed = (data) => {
  fs.writeFileSync(markerPath(), JSON.stringify(data, null, 2));
};

const readPendingSeed = () => {
  try {
    return JSON.parse(fs.readFileSync(markerPath(), "utf8"));
  } catch {
    return null;
  }
};

const clearPendingSeed = () => {
  try { fs.unlinkSync(markerPath()); } catch { /* already gone */ }
};

module.exports = {
  planFullSeed,
  writeSchemaFiles,
  writePendingSeed,
  readPendingSeed,
  clearPendingSeed,
};
