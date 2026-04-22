import { getFetchClient } from "@strapi/strapi/admin";

import { basePath } from "./client";

export const importData = async (payload) => {
  const { post } = getFetchClient();
  const { data } = await post(`${basePath}/import`, payload);
  return data?.data;
};
