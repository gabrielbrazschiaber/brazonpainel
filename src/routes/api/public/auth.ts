import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/auth")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(JSON.stringify({ ok: true, source: "minimal" }), { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      },
    },
  },
});
