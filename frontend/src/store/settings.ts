import { create } from "zustand";
import { api } from "@/lib/api";
import type { AppSettings } from "@/types";

const THEME_KEY = "idesigner_theme";

const DEFAULTS: AppSettings = {
  app_name: "iDesigner",
  currency_code: "INR",
  currency_symbol: "₹",
  currency_locale: "en-IN",
  default_units: "cm",
  accent_color: "#4f46e5",
};

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

interface SettingsState {
  settings: AppSettings;
  theme: Theme;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULTS,
  theme: (localStorage.getItem(THEME_KEY) as Theme) || "light",

  load: async () => {
    applyTheme(get().theme);
    try {
      const { data } = await api.get<AppSettings>("/settings");
      set({ settings: data });
    } catch {
      // not logged in yet / offline — keep defaults
    }
  },

  update: async (patch) => {
    const { data } = await api.put<AppSettings>("/settings", patch);
    set({ settings: data });
  },

  setTheme: (t) => {
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
    set({ theme: t });
  },

  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

// formatter that respects the configured currency
export function useMoney() {
  const { settings } = useSettings();
  return (value: number) => {
    try {
      return new Intl.NumberFormat(settings.currency_locale, {
        style: "currency",
        currency: settings.currency_code,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${settings.currency_symbol}${Math.round(value).toLocaleString()}`;
    }
  };
}
