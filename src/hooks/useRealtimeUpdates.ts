import { useEffect, useState, useRef } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { getSignalRConnectionInfo } from "@/lib/api-azure";

export const useRealtimeUpdates = () => {
  const { dbUser, setProcessingStatus, setDownloadLinks, sessionId } =
    useSessionStore();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Function to connect to Web PubSub
    console.log("Hook running. dbUser:", dbUser);
    const connect = async () => {
      // If no user or already connected/connecting, skip
      if (!dbUser || socketRef.current?.readyState === WebSocket.OPEN) return;

      try {
        // 1. Get the Connection URL from your Backend
        const info = await getSignalRConnectionInfo(dbUser.id);
        if (!info?.url) {
          console.error("Missing Web PubSub connection info");
          return;
        }

        // 2. Connect using standard WebSocket with Azure subprotocol
        const ws = new WebSocket(info.url, "json.webpubsub.azure.v1");

        ws.onopen = () => {
          console.log("Web PubSub Connected");
          setIsConnected(true);
          if (reconnectTimeoutRef.current)
            clearTimeout(reconnectTimeoutRef.current);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // Azure Web PubSub wraps the actual data in a 'data' field when using json subprotocol
            // Message format: { type: 'message', data: { ...your_payload... } }
            if (message.type === "message" && message.data) {
              const payload = message.data;

              // Handle SESSION_UPDATE (Status changes)
              if (payload.type === "SESSION_UPDATE") {
                // Only update if it matches the current session
                if (payload.sessionId === sessionId) {
                  console.log("Session Update:", payload.status);
                  setProcessingStatus(payload.status);

                  // If there are download links (e.g. transcriptKey), construct the URLs
                  if (payload.transcriptKey || payload.minutesKey) {
                    // You might need to fetch fresh SAS urls here or construct them if the payload has them
                    // For now, we trigger a status update which usually causes a re-fetch in other components
                  }
                }
              }

              // Handle PROGRESS_UPDATE (The missing bars!)
              if (payload.type === "PROGRESS_UPDATE") {
                if (payload.sessionId === sessionId) {
                  console.log(
                    `Progress: ${payload.stage} - ${payload.progress}%`
                  );
                  // Ideally, call setProgress(payload.progress) if it exists in your store
                  // or just log it for now to verify connection
                }
              }
            }
          } catch (err) {
            console.error("Failed to parse WebSocket message", err);
          }
        };

        ws.onclose = () => {
          console.log("Web PubSub Disconnected");
          setIsConnected(false);
          socketRef.current = null;
          // Attempt reconnect in 3 seconds
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
          console.error("Web PubSub Error:", err);
          ws.close();
        };

        socketRef.current = ws;
      } catch (err) {
        console.error("Failed to initialize Web PubSub:", err);
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      }
    };

    if (dbUser) {
      connect();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [dbUser, sessionId, setProcessingStatus, setDownloadLinks]);

  return { isConnected };
};
