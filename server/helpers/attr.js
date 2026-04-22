"use strict";

const isPasswordAttr = (attr) => attr?.type === "password";

const isRelationAttr = (attr) => attr?.type === "relation";

const isMediaAttr = (attr) => attr?.type === "media" || (attr?.type === "relation" && attr?.target === "plugin::upload.file");

const isComponentAttr = (attr) => attr?.type === "component";

const isDynamicZoneAttr = (attr) => attr?.type === "dynamiczone";

module.exports = {
  isPasswordAttr,
  isRelationAttr,
  isMediaAttr,
  isComponentAttr,
  isDynamicZoneAttr,
};
