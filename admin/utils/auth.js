export const isAuthError = (err) => {
  const status = err?.status ?? err?.response?.status;
  return status === 401 || status === 403;
};
