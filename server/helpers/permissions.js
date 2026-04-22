"use strict";

const getAdminUser = (ctx) => ctx?.state?.user;

const resolveAbility = (ctx) => {
  if (ctx?.state?.userAbility) return ctx.state.userAbility;
  const user = getAdminUser(ctx);
  if (user?.ability && typeof user.ability.can === "function") return user.ability;
  return null;
};

const createChecker = (ability, uid) => {
  try {
    return strapi
      .plugin("content-manager")
      .service("permission-checker")
      .create({ userAbility: ability, model: uid });
  } catch {
    return null;
  }
};

const getChecker = (ctx, uid) => {
  if (!getAdminUser(ctx)) return null;
  const ability = resolveAbility(ctx);
  if (!ability) return null;
  return createChecker(ability, uid);
};

module.exports = { getAdminUser, resolveAbility, getChecker };
