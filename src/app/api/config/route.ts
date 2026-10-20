import { publicServerInfo } from '@/lib/llm-config';

export const dynamic = 'force-dynamic';

/**
 * Tells the UI whether this server has its own LLM configuration (self-host
 * mode) or expects the visitor's key (bring-your-own-key mode). Never returns
 * a key or a private endpoint URL.
 */
export function GET() {
  return Response.json(publicServerInfo(), { headers: { 'Cache-Control': 'no-store' } });
}
