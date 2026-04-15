import { defineStore } from "pinia";
import {
  authApi,
  type AuthResponse,
  type AuthUser,
  type Business,
} from "@/services/api";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  business: Business | null;
  initialized: boolean;
};

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    token: localStorage.getItem("ai-concierge-token"),
    user: null,
    business: null,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    businessId: (state) => state.business?.id ?? null,
    businessName: (state) => state.business?.name ?? null,
  },
  actions: {
    setSession(payload: AuthResponse | { token: string; user: AuthUser; business: Business }) {
      this.token = payload.token;
      this.user = payload.user;
      this.business = payload.business;
      this.initialized = true;
      localStorage.setItem("ai-concierge-token", payload.token);
    },
    clearSession() {
      this.token = null;
      this.user = null;
      this.business = null;
      this.initialized = true;
      localStorage.removeItem("ai-concierge-token");
    },
    async hydrate() {
      if (!this.token) {
        this.initialized = true;
        return;
      }

      try {
        const { data } = await authApi.me();
        this.user = data.user;
        this.business = data.business;
      } catch {
        this.clearSession();
      } finally {
        this.initialized = true;
      }
    },
  },
});
