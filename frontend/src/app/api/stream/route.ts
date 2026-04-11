export async function GET(request: Request) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const incoming = new URL(request.url);
  const userWallet = incoming.searchParams.get("user_wallet");
  const upstreamUrl = userWallet
    ? `${apiUrl}/stream?user_wallet=${encodeURIComponent(userWallet)}`
    : `${apiUrl}/stream`;

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  try {
    const upstream = await fetch(upstreamUrl);
    const reader = upstream.body?.getReader();

    if (!reader) {
      await writer.write(encoder.encode("data: Backend unavailable\n\n"));
      await writer.close();
      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch {
        // Client or upstream disconnected
      } finally {
        try {
          await writer.close();
        } catch {
          // Stream already closed
        }
      }
    })();
  } catch {
    try {
      await writer.write(encoder.encode("data: Backend unavailable\n\n"));
      await writer.close();
    } catch {
      // Stream already closed
    }
  }

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
