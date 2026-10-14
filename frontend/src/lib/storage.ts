const TOKEN_KEY = "docchat_token";
const MODEL_KEY = "docchat_model";

export const sessionStorage = {
  getToken: () => window.localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => window.localStorage.removeItem(TOKEN_KEY),
  getModel: () => window.localStorage.getItem(MODEL_KEY),
  setModel: (model: string) => window.localStorage.setItem(MODEL_KEY, model),
};
