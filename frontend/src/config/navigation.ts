import {
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Files,
  Home,
  KeyRound,
  LayoutDashboard,
  PlugZap,
  Settings2,
  ShieldCheck,
  Upload,
  UserCog,
  UsersRound,
  Webhook
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppSubNavItem = {
  key: string;
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: number;
};

export type AppMainNavItem = {
  key: string;
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  subItems: AppSubNavItem[];
};

export const APP_MAIN_NAV_ITEMS: AppMainNavItem[] = [
  {
    key: "dashboard",
    to: "/dashboard",
    label: "Panel",
    description: "Glowne podsumowanie",
    icon: LayoutDashboard,
    subItems: [
      {
        key: "dashboard-overview",
        to: "/dashboard/overview",
        label: "Przeglad",
        description: "Widok glowny",
        icon: Home
      },
      {
        key: "dashboard-team",
        to: "/dashboard/team",
        label: "Zespol",
        description: "Zespol i statusy",
        icon: UsersRound
      }
    ]
  },
  {
    key: "analytics",
    to: "/analytics",
    label: "Analizy Excel",
    description: "Raporty i przetwarzanie",
    icon: FileSpreadsheet,
    subItems: [
      {
        key: "analytics-imported-files",
        to: "/analytics/imported-files",
        label: "Wgrane pliki",
        description: "Upload plikow Excel",
        icon: Upload
      },
      {
        key: "analytics-summarized",
        to: "/analytics/summarized",
        label: "Podsumowania",
        description: "Podsumowania i wnioski",
        icon: BarChart3
      }
    ]
  },
  {
    key: "orders",
    to: "/orders",
    label: "Zlecenia",
    description: "Lista zadan roboczych",
    icon: ClipboardList,
    subItems: [
      {
        key: "orders-list",
        to: "/orders/list",
        label: "Lista zlecen",
        description: "Biezace zlecenia",
        icon: ClipboardList
      },
      {
        key: "orders-archive",
        to: "/orders/archive",
        label: "Archiwum",
        description: "Historia zlecen",
        icon: Files
      }
    ]
  },
  {
    key: "settings",
    to: "/account",
    label: "Ustawienia",
    description: "Konfiguracja konta",
    icon: Settings2,
    subItems: [
      {
        key: "settings-account",
        to: "/account",
        label: "Konto",
        description: "Profil i avatar",
        icon: UserCog
      },
      {
        key: "settings-security",
        to: "/account/security",
        label: "Bezpieczenstwo",
        description: "Sesje i bezpieczenstwo",
        icon: ShieldCheck
      }
    ]
  },
  {
    key: "integrations",
    to: "/integrations",
    label: "Integracje API",
    description: "Testy backend + auth",
    icon: PlugZap,
    subItems: [
      {
        key: "integrations-connections",
        to: "/integrations/connections",
        label: "Polaczenia",
        description: "Polaczenia systemowe",
        icon: PlugZap
      },
      {
        key: "integrations-api-keys",
        to: "/integrations/api-keys",
        label: "Klucze API",
        description: "Klucze dostepu",
        icon: KeyRound
      },
      {
        key: "integrations-webhooks",
        to: "/integrations/webhooks",
        label: "Webhooki",
        description: "Zdarzenia i callbacki",
        icon: Webhook
      }
    ]
  }
];

export const DEFAULT_APP_MAIN_ROUTE = APP_MAIN_NAV_ITEMS[0]?.to ?? "/dashboard";
export const DEFAULT_APP_ROUTE =
  APP_MAIN_NAV_ITEMS[0]?.subItems[0]?.to ?? "/dashboard/overview";
