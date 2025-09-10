export const NAV_ROUTE_ORDER = ['/notes', '/', '/settings'] as const;

export type NavRoute = typeof NAV_ROUTE_ORDER[number];
