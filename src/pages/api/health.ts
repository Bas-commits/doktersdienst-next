import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  await query("SELECT 1");
  res.status(200).json({ ok: true });
}
