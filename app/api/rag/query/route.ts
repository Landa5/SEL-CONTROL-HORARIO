/**
 * app/api/rag/query/route.ts
 * Proxy hacia el servidor FastAPI de RAG-SEL.
 * El cliente Next.js llama a este endpoint en vez de llamar directamente
 * a localhost:8000 (evita CORS y expone la URL interna del RAG).
 */
import { NextRequest, NextResponse } from "next/server";

const RAG_API_URL = process.env.RAG_API_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const ragRes = await fetch(`${RAG_API_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify(body),
      // Mantenemos el abort, pero en stream podemos ser más generosos
      signal: AbortSignal.timeout(60_000),
    });

    if (!ragRes.ok) {
      const errText = await ragRes.text();
      return NextResponse.json(
        { detail: `Error en RAG API: ${errText}` },
        { status: ragRes.status }
      );
    }

    // Devolver el stream directo para SSE
    return new Response(ragRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[RAG proxy] Error:", msg);

    if (msg.includes("abort") || msg.includes("timeout")) {
      return NextResponse.json(
        { detail: "El asistente tardó demasiado en responder. Inténtalo de nuevo." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        detail:
          "No se pudo conectar con el asistente RAG. Asegúrate de que el servidor está activo (localhost:8000).",
      },
      { status: 503 }
    );
  }
}
