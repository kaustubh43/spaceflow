import { create } from "zustand";
import { api, tokenStore } from "@/lib/api";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    full_name: string,
    password: string,
    role: string
  ) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    if (!tokenStore.access) {
      set({ loading: false });
      return;
    }
    try {
      const { data } = await api.get<User>("/auth/me");
      set({ user: data, loading: false });
    } catch {
      tokenStore.clear();
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    tokenStore.set(data.access_token, data.refresh_token);
    const me = await api.get<User>("/auth/me");
    set({ user: me.data });
  },

  register: async (email, full_name, password, role) => {
    const { data } = await api.post("/auth/register", {
      email,
      full_name,
      password,
      role,
    });
    tokenStore.set(data.access_token, data.refresh_token);
    const me = await api.get<User>("/auth/me");
    set({ user: me.data });
  },

  logout: () => {
    tokenStore.clear();
    set({ user: null });
  },
}));
