export async function nlToErd(prompt: string): Promise<{
  entities: Array<{ name: string; attributes: Array<{ name: string; type: string; required?: boolean; pk?: boolean }> }>;
  relations: Array<{ sourceName: string; targetName: string; sourceCard: "ONE"|"MANY"; targetCard: "ONE"|"MANY"; owningSide?: "source"|"target" }>;
}> {
  const r = await fetch("/api/ai/nl-to-erd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!r.ok) throw new Error("Fallo NL→ERD");
  return r.json();
}
