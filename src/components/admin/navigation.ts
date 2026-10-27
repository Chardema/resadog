import {
  BarChart3,
  CalendarCheck,
  CalendarCog,
  Calculator,
  CreditCard,
  LayoutDashboard,
  MessageSquareText,
  TicketPercent,
  UsersRound,
} from "lucide-react";

export const adminMenuItems = [
  { href: "/admin/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Réservations", icon: CalendarCheck },
  { href: "/admin/pricing", label: "Simulateur", icon: Calculator, adminOnly: true },
  { href: "/admin/calendar", label: "Calendrier", icon: CalendarCog },
  { href: "/admin/clients", label: "Clients", icon: UsersRound },
  { href: "/admin/coupons", label: "Codes promo", icon: TicketPercent },
  { href: "/admin/reviews", label: "Avis", icon: MessageSquareText },
  { href: "/admin/revenue", label: "Finance", icon: CreditCard },
  { href: "/admin/calendar-sync", label: "Synchronisation", icon: BarChart3 },
];
