import {
  ArchiveIcon,
  BarChart3,
  FileSpreadsheet,
  Home,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  UserCog,
  UsersRound
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
    description: "Główne podsumowanie",
    icon: LayoutDashboard,
    subItems: [
      {
        key: "dashboard-overview",
        to: "/dashboard/overview",
        label: "Przegląd",
        description: "Widok główny",
        icon: Home
      },
      {
        key: "dashboard-team",
        to: "/dashboard/team",
        label: "Zespół",
        description: "Zespół i statusy",
        icon: UsersRound
      }
    ]
  },
  {
    key: "accounting",
    to: "/accounting",
    label: "Księgowość",
    description: "Raporty i przetwarzanie",
    icon: FileSpreadsheet,
    subItems: [
      {
        key: "accounting-analyze",
        to: "/accounting/analyze",
        label: "Analizuj Excel",
        description: "Wgraj i analizuj pliki Excel",
        icon: FileSpreadsheet
      }
    ]
  },
  {
    key: "results",
    to: "/results",
    label: "Wyniki",
    description: "Archiwum i analizy",
    icon: BarChart3,
    subItems: [
      {
        key: "results-archive",
        to: "/results/archive",
        label: "Archiwum",
        description: "Historia analiz",
        icon: ArchiveIcon
      },
      {
        key: "results-analysis",
        to: "/results/analysis",
        label: "Analiza",
        description: "Raporty i wnioski",
        icon: BarChart3
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
        label: "Bezpieczeństwo",
        description: "Sesje i bezpieczeństwo",
        icon: ShieldCheck
      }
    ]
  }
];

export const DEFAULT_APP_MAIN_ROUTE = APP_MAIN_NAV_ITEMS[0]?.to ?? "/dashboard";
export const DEFAULT_APP_ROUTE =
  APP_MAIN_NAV_ITEMS[0]?.subItems[0]?.to ?? "/dashboard/overview";
