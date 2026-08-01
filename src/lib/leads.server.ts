/**
 * Fachada server-only do módulo comercial.
 * A implementação vive em leads-base / leads-crud / leads-dashboard /
 * leads-followups; este arquivo apenas reexporta para manter os imports
 * existentes (leads.functions.ts) estáveis.
 */
export * from "@/lib/leads-base.server";
export * from "@/lib/leads-crud.server";
export * from "@/lib/leads-dashboard.server";
export * from "@/lib/leads-followups.server";
