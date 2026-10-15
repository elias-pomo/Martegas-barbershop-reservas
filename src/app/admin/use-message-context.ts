"use client";

import { useSyncExternalStore } from "react";
import type { MessageContext } from "@/lib/domain/messages";
import type { AgendaBusiness } from "./types";

const noopSubscribe = () => () => {};

/** Contexto para armar mensajes de WhatsApp en el navegador (necesita el origin del sitio). */
export function useMessageContext(business: AgendaBusiness): MessageContext {
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  return {
    businessName: business.name,
    address: business.address,
    timeZone: business.timeZone,
    templates: business.templates,
    origin,
    slug: business.slug,
  };
}
