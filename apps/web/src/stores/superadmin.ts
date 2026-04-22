import { defineStore } from "pinia";
import { platformApi, setSuperadminAuthToken, type SuperadminUser } from "../services/api";

type SuperadminState = {
  token: string | null;
  user: SuperadminUser | null;
  initialized: boolean;
};

export const useSuperadminStore = defineStore("superadmin", {
  state: (): SuperadminState => ({
    token: localStorage.getItem("ai-concierge-superadmin-token"),
    user: null,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
  },
  actions: {
    setSession(payload: { token: string; superadmin: SuperadminUser }) {
      this.token = payload.token;
      this.user = payload.superadmin;
      this.initialized = true;
      setSuperadminAuthToken(payload.token);
    },
    clearSession() {
      this.token = null;
      this.user = null;
      this.initialized = true;
      setSuperadminAuthToken(null);
    },
    async hydrate() {
      if (!this.token) {
        this.initialized = true;
        return;
      }
      try {
        const { data } = await platformApi.me();
        this.user = data.superadmin;
      } catch {
        this.clearSession();
      } finally {
        this.initialized = true;
      }
    },
  },
});
