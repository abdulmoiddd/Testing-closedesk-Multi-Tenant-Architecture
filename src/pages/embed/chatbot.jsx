// src/pages/embed/chatbot.jsx
"use client";

import { useRouter } from "next/router";
import Head from "next/head";
import AicyroChatbot from "@/components/Chatbot/AicyroChatbot";

export default function EmbeddedChatbotPage() {
  const router = useRouter();
  const { tenant, tenant_id } = router.query;
  const activeTenantId = tenant || tenant_id || "default";

  return (
    <>
      <Head>
        <title>CloseDesk AI Assistant</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="w-full h-full bg-transparent overflow-hidden">
        <AicyroChatbot tenantId={activeTenantId} />
      </div>
    </>
  );
}
