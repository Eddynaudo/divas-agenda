// Diva's Agenda — invio promemoria (chiamata ogni minuto da pg_cron)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const TZ = "Europe/Rome";
const fmtDay = (d: Date) =>
  d.toLocaleDateString("it-IT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function whenLabel(start: Date) {
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  if (key(start) === key(today)) return "oggi";
  if (key(start) === key(tomorrow)) return "domani";
  return fmtDay(start);
}

function offsetLabel(min: number) {
  if (min % 1440 === 0) return min === 1440 ? "domani" : `tra ${min / 1440} giorni`;
  if (min % 60 === 0) return min === 60 ? "tra 1 ora" : `tra ${min / 60} ore`;
  return `tra ${min} minuti`;
}

function normalizePhone(p: string) {
  let n = (p || "").replace(/[^\d+]/g, "");
  if (n.startsWith("00")) n = "+" + n.slice(2);
  if (!n.startsWith("+")) n = "+39" + n;
  return n.replace("+", "");
}

function fillTemplate(tpl: string, a: any) {
  const start = new Date(a.starts_at);
  return tpl
    .replaceAll("{nome}", (a.client_name || "").split(" ")[0])
    .replaceAll("{quando}", whenLabel(start))
    .replaceAll("{data}", fmtDay(start))
    .replaceAll("{ora}", fmtTime(start))
    .replaceAll("{servizi}", (a.services || []).join(", ").toLowerCase());
}

Deno.serve(async (req) => {
  const { data: secRows } = await sb.from("app_secrets").select("key,value");
  const sec: Record<string, string> = Object.fromEntries((secRows || []).map((r) => [r.key, r.value]));
  if (req.headers.get("x-cron-secret") !== sec.cron_secret) {
    return new Response("unauthorized", { status: 401 });
  }
  webpush.setVapidDetails(sec.vapid_subject, sec.vapid_public, sec.vapid_private);

  const now = new Date();
  const { data: due, error } = await sb
    .from("reminders")
    .select("*, appointment:appointments(*)")
    .eq("status", "pending")
    .lte("send_at", now.toISOString())
    .gte("send_at", new Date(now.getTime() - 6 * 3600 * 1000).toISOString())
    .limit(100);
  if (error) return new Response(error.message, { status: 500 });

  const subsCache: Record<string, any[]> = {};
  let adminIds: string[] | null = null;
  const results: any[] = [];

  // impostazioni del salone (unica riga)
  const { data: salonSettings } = await sb.from("settings").select("*").limit(1).maybeSingle();

  async function pushTo(userId: string, payload: unknown) {
    if (!subsCache[userId]) {
      // solo account attivi
      const { data: prof } = await sb.from("profiles").select("active, role").eq("user_id", userId).maybeSingle();
      // account disattivati e sotto-admin non ricevono notifiche
      if (prof && (!prof.active || prof.role === "subadmin")) { subsCache[userId] = []; }
      else {
        const { data } = await sb.from("push_subscriptions").select("*").eq("user_id", userId);
        subsCache[userId] = data || [];
      }
    }
    let ok = 0;
    for (const s of subsCache[userId]) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 3600, urgency: "high" },
        );
        ok++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }
    return ok;
  }

  for (const r of due || []) {
    const a = r.appointment;
    if (!a || a.status !== "scheduled") {
      await sb.from("reminders").update({ status: "skipped" }).eq("id", r.id);
      continue;
    }
    const start = new Date(a.starts_at);
    const to = a.assigned_to || a.user_id; // operatrice assegnata, altrimenti chi l'ha creato
    const servizi = (a.services || []).join(", ");
    try {
      if (r.target === "staff") {
        const n = await pushTo(to, {
          title: `⏰ ${a.client_name} — ${offsetLabel(r.offset_min)}`,
          body: `${whenLabel(start)} alle ${fmtTime(start)} · ${servizi}${a.price ? ` · € ${a.price}` : ""}`,
          tag: `appt-${a.id}-staff-${r.slot}`,
          url: `./#/app/${a.id}`,
        });
        await sb.from("reminders").update({
          status: n > 0 ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          last_error: n > 0 ? null : "nessun dispositivo registrato",
        }).eq("id", r.id);
      } else {
        const text = fillTemplate(
          salonSettings?.client_template ||
            "Ciao {nome}! Ti ricordiamo l'appuntamento {quando} alle {ora}.",
          a,
        );
        let sentAuto = false;
        let delivered = 0;
        let lastErr: string | null = null;
        // Invio automatico via WhatsApp Business Cloud API (Meta) se configurato
        if (a.client_channel === "whatsapp" && sec.wa_token && sec.wa_phone_id && a.phone) {
          const res = await fetch(`https://graph.facebook.com/v21.0/${sec.wa_phone_id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${sec.wa_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: normalizePhone(a.phone),
              type: "template",
              template: {
                name: sec.wa_template || "promemoria_appuntamento",
                language: { code: sec.wa_lang || "it" },
                components: [{
                  type: "body",
                  parameters: [
                    { type: "text", text: (a.client_name || "").split(" ")[0] },
                    { type: "text", text: whenLabel(start) },
                    { type: "text", text: fmtTime(start) },
                  ],
                }],
              },
            }),
          });
          if (res.ok) sentAuto = true;
          else lastErr = (await res.text()).slice(0, 300);
        }
        if (!sentAuto && a.phone && a.client_channel !== "nessuno") {
          // Invio con un tocco: la notifica arriva SEMPRE all'amministratrice (WhatsApp Business del salone),
          // anche se l'appuntamento è stato creato da un dipendente
          if (!adminIds) {
            const { data: ads } = await sb.from("profiles").select("user_id").eq("role", "admin").eq("active", true);
            adminIds = (ads || []).map((x) => x.user_id);
          }
          for (const adminId of (adminIds.length ? adminIds : [to])) delivered += await pushTo(adminId, {
            title: `💬 Promemoria per ${a.client_name}`,
            body: `Tocca per inviare il messaggio (${a.client_channel === "sms" ? "SMS" : "WhatsApp"})`,
            tag: `appt-${a.id}-client-${r.slot}`,
            url: `./#/send/${a.id}/${r.slot}`,
          });
        }
        await sb.from("reminders").update({
          status: sentAuto || delivered > 0 ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          last_error: sentAuto ? null : delivered > 0 ? "inviata notifica all'amministratrice"
            : (lastErr ? `WhatsApp API: ${lastErr}` : "l'amministratrice non ha attivato le notifiche"),
        }).eq("id", r.id);
      }
      results.push({ id: r.id, ok: true });
    } catch (e) {
      await sb.from("reminders").update({ status: "failed", last_error: String(e).slice(0, 300) }).eq("id", r.id);
      results.push({ id: r.id, ok: false });
    }
  }
  // ── Richieste di modifica: avvisa l'admin delle nuove, e il dipendente dell'esito ──
  const { data: newReqs } = await sb.from("change_requests").select("*").eq("status", "pending").is("admin_notified_at", null).limit(50);
  if (newReqs?.length) {
    const { data: admins } = await sb.from("profiles").select("user_id").eq("role", "admin").eq("active", true);
    const { data: people } = await sb.from("profiles").select("user_id, full_name, email");
    const nameOf = (id: string) => { const p = (people || []).find((x) => x.user_id === id); return p?.full_name || p?.email || "Un dipendente"; };
    for (const cr of newReqs) {
      for (const ad of admins || []) {
        await pushTo(ad.user_id, {
          title: "🛎️ Richiesta di modifica",
          body: `${nameOf(cr.requested_by)}: ${cr.summary || "modifica alle impostazioni"}. Tocca per approvare o rifiutare.`,
          tag: `cr-${cr.id}`,
          url: "./#/requests",
        });
      }
      await sb.from("change_requests").update({ admin_notified_at: new Date().toISOString() }).eq("id", cr.id);
    }
  }
  const { data: decided } = await sb.from("change_requests").select("*").neq("status", "pending").is("requester_notified_at", null).limit(50);
  for (const cr of decided || []) {
    await pushTo(cr.requested_by, {
      title: cr.status === "approved" ? "✅ Modifica approvata" : "❌ Modifica non approvata",
      body: cr.summary || "La tua richiesta di modifica è stata valutata dall'amministratrice.",
      tag: `cr-${cr.id}-esito`,
      url: "./",
    });
    await sb.from("change_requests").update({ requester_notified_at: new Date().toISOString() }).eq("id", cr.id);
  }

  // ── Avvisi ai dipendenti (es. promemoria inviato alla cliente) ──
  const { data: notices } = await sb.from("notices").select("*").is("pushed_at", null).limit(100);
  for (const nt of notices || []) {
    await pushTo(nt.user_id, { title: nt.title, body: nt.body || "", tag: `notice-${nt.id}`, url: "./#/notices" });
    await sb.from("notices").update({ pushed_at: new Date().toISOString() }).eq("id", nt.id);
  }

  return Response.json({ processed: results.length, notices: (notices || []).length, requests: (newReqs || []).length + (decided || []).length });
});
