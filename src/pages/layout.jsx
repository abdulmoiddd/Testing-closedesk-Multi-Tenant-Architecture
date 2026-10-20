import { useRouter } from "next/router";
import AicyroChatbot from "@/components/Chatbot/AicyroChatbot";

export default function RootLayout({ children }) {
  const router = useRouter();

  // Check if the current page is the admin dashboard (/lg), the logs page (/logs), or the embed view (/embed/*)
  const isDashboard = router.pathname === "/lg";
  const isLogsPage = router.pathname === "/logs";
  const isEmbedPage = router.pathname.startsWith("/embed");

  // Only show the floating chatbot on public marketing pages
  const showChatbot = !isDashboard && !isLogsPage && !isEmbedPage;

  return (
    <div>
      <main>
        {children}

        {/* Only render the chatbot on public marketing routes */}
        {showChatbot && <AicyroChatbot />}
      </main>
    </div>
  );
}
