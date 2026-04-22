"use strict";

const BASE_AUTH_TABLES = [
  "admin_roles",
  "admin_users",
  "admin_permissions",
  "strapi_api_tokens",
  "strapi_api_token_permissions",
  "strapi_transfer_tokens",
  "strapi_transfer_token_permissions",
  "strapi_sessions",
];

const LINK_AUTH_TABLES = [
  "admin_users_roles_lnk",
  "admin_users_roles_links",
  "admin_permissions_role_lnk",
  "admin_permissions_role_links",
  "strapi_api_token_permissions_token_lnk",
  "strapi_api_token_permissions_token_links",
  "strapi_transfer_token_permissions_token_lnk",
  "strapi_transfer_token_permissions_token_links",
];

const AUTH_TABLES = [...BASE_AUTH_TABLES, ...LINK_AUTH_TABLES];

const AUTH_CORE_STORE_KEYS = [
  "strapi::admin::auth",
  "strapi::admin::auth.secret",
  "admin::auth.secret",
  "strapi::jwt.secret",
  "plugin::users-permissions.jwt",
];

module.exports = {
  BASE_AUTH_TABLES,
  LINK_AUTH_TABLES,
  AUTH_TABLES,
  AUTH_CORE_STORE_KEYS,
};
