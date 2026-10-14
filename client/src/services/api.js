import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});
let csrfToken;
let csrfPromise;
let refreshPromise;
export async function security() {
  if (!csrfPromise)
    csrfPromise = api
      .get("/csrf")
      .then(({ data }) => {
        csrfToken = data.data.token;
        return data.data;
      })
      .catch((e) => {
        csrfPromise = null;
        throw e;
      });
  return csrfPromise;
}
api.interceptors.request.use(async (config) => {
  if (!["get", "head", "options"].includes(config.method)) {
    await security();
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const req = error.config;
    if (
      error.response?.status === 401 &&
      !req._retry &&
      (!req.url.startsWith("/auth/") || req.url === "/auth/me")
    ) {
      req._retry = true;
      try {
        if (!refreshPromise)
          refreshPromise = api.post("/auth/refresh").finally(() => {
            refreshPromise = null;
          });
        await refreshPromise;
        return api(req);
      } catch {}
    }
    throw error;
  },
);
export const get = async (url) => (await api.get(url)).data.data;
export const message = (error) =>
  error.response?.data?.error?.message || error.message || "Please try again.";
