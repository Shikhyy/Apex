export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  try {
    const upstream = await fetch(`${apiUrl}/stream`);
    const reader = upstream.body?.getReader();

    if (!reader) {
      await writer.write(encoder.encode("data: Backend unavailable\n\n"));
      await writer.close();
      return new Response("Backend unavailable", { status: 503 });
    }

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch {
        // Upstream disconnected
      } finally {
        await writer.close();
      }
    })();
  } catch {
    await writer.write(encoder.encode("data: Backend unavailable\n\n"));
    await writer.close();
  }

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
