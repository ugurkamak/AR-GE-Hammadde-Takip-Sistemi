import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Mode = "tds" | "sds" | "comparison";
type InputDocument = { id: string; path: string; fileName: string; documentType: "tds" | "sds" };

const instructions = `
Sen boya, kaplama ve kimyasal hammaddeler konusunda deneyimli bir Ar-Ge teknik doküman asistanısın.
YALNIZCA kullanıcının eklediği PDF belgelerindeki bilgiye dayan. İnternet araştırması yapma.
Yanıtın Türkçe olmalı. Belgedeki veriler ile teknik yorumları açıkça ayır.
Hiçbir değer, limit, CAS numarası, tehlike sınıfı, test metodu veya sayfa numarası uydurma.
Bulunmayan alanları "Belgede belirtilmemiş" olarak işaretle. Okunamayan bilgiyi tahmin etme.
Birimleri ve ondalık ayraçlarını koru. Farklı test metotları veya koşullarıyla elde edilmiş değerleri
doğrudan karşılaştırma; uyumsuzluk uyarısı ekle. "Daha yüksek/düşük" ifadesini otomatik olarak
"daha iyi" şeklinde yorumlama. Kesin performans veya uygunluk kararı için gerekli laboratuvar
testlerini belirt. SDS özeti resmi güvenlik bilgi formunun yerine geçmez.
Çıktı yalnızca aşağıdaki alanlara sahip geçerli JSON olsun:
{
 "title": string,
 "documentType": "tds"|"sds"|"comparison",
 "executiveSummary": string,
 "parameters": [{"name":string,"value":string,"unit":string,"testMethod":string,"sourcePage":string,"technicalMeaning":string,"interpretation":string}],
 "comparison": [{"parameter":string,"documentA":string,"documentB":string,"difference":string,"comment":string}],
 "hazards": [{"hazard":string,"whatItMeans":string,"precautions":string,"sourceSection":string}],
 "safetyChecklist": [string],
 "missingInformation": [string],
 "recommendations": [string],
 "sourceNotes": [string]
}
TDS analizinde parametreleri doldur; SDS analizinde hazards ve safetyChecklist bölümlerine öncelik ver.
Tek belge analizinde comparison boş dizi olmalı. Referanssız TDS analizinde ürünün mutlak uygunluğu hakkında
kesin hüküm verme. Kaynak sayfa numarası belge üzerinde doğrulanamıyorsa "Doğrulanamadı" yaz.
`;

async function readPdfForOpenAI(file: File, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", file, file.name);
  const uploaded = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const uploadedJson = await uploaded.json();
  if (!uploaded.ok || !uploadedJson.id) {
    throw new Error(uploadedJson.error?.message ?? "PDF AI servisine güvenli şekilde aktarılamadı.");
  }
  return uploadedJson.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Yalnızca POST desteklenir." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Oturum açmanız gerekiyor." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey || !openaiKey) {
    return json({ error: "Sunucu ayarları eksik. Yönetici Edge Function secrets ayarlarını kontrol etmeli." }, 500);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "Oturum doğrulanamadı." }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile?.is_active) return json({ error: "Bu kullanıcı için erişim etkin değil." }, 403);

  let body: { mode?: Mode; documents?: InputDocument[] };
  try { body = await req.json(); } catch { return json({ error: "İstek gövdesi geçerli JSON değil." }, 400); }

  const mode = body.mode;
  const docs = body.documents ?? [];
  if (!mode || !["tds", "sds", "comparison"].includes(mode)) return json({ error: "Geçersiz analiz türü." }, 400);
  if ((mode === "comparison" && docs.length !== 2) || (mode !== "comparison" && docs.length !== 1)) {
    return json({ error: "Karşılaştırma için iki, tekil analiz için bir PDF seçin." }, 400);
  }
  if (docs.some((d) => !d.id || !d.path || !d.fileName || !["tds", "sds"].includes(d.documentType))) {
    return json({ error: "Belge bilgileri eksik." }, 400);
  }
  if (mode === "comparison" && docs.some((d) => d.documentType !== "tds")) {
    return json({ error: "Karşılaştırma yalnızca iki TDS belgesi arasında yapılabilir." }, 400);
  }

  const uploadedIds: string[] = [];
  try {
    const files: File[] = [];
    for (const doc of docs) {
      const { data: metadata, error: metadataError } = await supabase
        .from("tds_sds_documents")
        .select("id, owner_id, storage_path, file_name, document_type")
        .eq("id", doc.id)
        .eq("owner_id", userData.user.id)
        .single();
      if (metadataError || !metadata || metadata.storage_path !== doc.path) {
        return json({ error: "Belge kaydı bulunamadı veya erişim izniniz yok." }, 403);
      }
      const { data: blob, error: downloadError } = await supabase.storage
        .from("tds-sds-private")
        .download(metadata.storage_path);
      if (downloadError || !blob) return json({ error: "Özel arşivdeki PDF okunamadı." }, 400);
      if (blob.size > 15 * 1024 * 1024) return json({ error: "PDF dosyası 15 MB sınırını aşıyor." }, 413);
      files.push(new File([blob], metadata.file_name, { type: "application/pdf" }));
    }

    for (const file of files) uploadedIds.push(await readPdfForOpenAI(file, openaiKey));

    const userContent: Array<Record<string, unknown>> = [
      { type: "input_text", text: `Analiz türü: ${mode}. Belgeler: ${docs.map((d, i) => `${i + 1}. ${d.fileName} (${d.documentType.toUpperCase()})`).join("; ")}. ${mode === "comparison" ? "İki TDS'yi aynı parametreler üzerinden karşılaştır; uyumsuz ölçüm koşullarını belirt." : ""}` },
      ...uploadedIds.map((id) => ({ type: "input_file", file_id: id })),
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions,
        input: [{ role: "user", content: userContent }],
        max_output_tokens: 7000,
      }),
    });
    const responseJson = await response.json();
    if (!response.ok) throw new Error(responseJson.error?.message ?? "AI analiz isteği başarısız oldu.");

    const outputText = (responseJson.output ?? [])
      .flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? [])
      .filter((item: { type?: string }) => item.type === "output_text")
      .map((item: { text?: string }) => item.text ?? "")
      .join("\n")
      .trim();
    if (!outputText) throw new Error("AI yanıtında rapor metni bulunamadı.");

    let report;
    try {
      const clean = outputText.replace(/^\`\`\`json\s*/i, "").replace(/^\`\`\`/, "").replace(/\`\`\`$/, "").trim();
      report = JSON.parse(clean);
    } catch {
      throw new Error("AI yanıtı beklenen rapor formatında değil. Lütfen tekrar deneyin.");
    }

    return json({ report, model: "gpt-4.1-mini" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Analiz sırasında beklenmeyen hata oluştu." }, 500);
  } finally {
    await Promise.all(uploadedIds.map((id) =>
      fetch(`https://api.openai.com/v1/files/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${openaiKey}` },
      }).catch(() => null)
    ));
  }
});
