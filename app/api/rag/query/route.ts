/**
 * app/api/rag/query/route.ts
 * Proxy hacia el servidor FastAPI de RAG-SEL.
 * El cliente Next.js llama a este endpoint en vez de llamar directamente
 * al RAG (evita CORS y gestiona credenciales de forma segura).
 */
import { NextRequest, NextResponse } from "next/server";

const RAG_API_URL = process.env.RAG_API_URL ?? "http://localhost:8000";
const RAG_APP_ID = process.env.RAG_APP_ID ?? "";
const RAG_API_KEY = process.env.RAG_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "1",
    };

    // Autenticación multi-tenant (credenciales API)
    if (RAG_APP_ID && RAG_API_KEY) {
      headers["X-App-Id"] = RAG_APP_ID;
      headers["X-Api-Key"] = RAG_API_KEY;
    }

    const ragRes = await fetch(`${RAG_API_URL}/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
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
          "No se pudo conectar con el asistente RAG. Asegúrate de que el servidor está activo.",
      },
      { status: 503 }
    );
  }
}
