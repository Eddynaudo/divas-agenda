// Diva's Agenda — gestione account (amministratrice; il sotto-admin può solo vedere l'elenco)
// L'identità viene verificata nel codice (auth.getUser), così ogni risposta include gli header CORS.
// Le password NON vengono impostate da qui: il reset avviene via email e la nuova password la sceglie l'utente.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Sessione scaduta: esci e rientra nell'app" }, 401);
    const { data: who, error: whoErr } = await admin.auth.getUser(jwt);
    if (whoErr || !who?.user) {
      console.log("getUser error", whoErr?.message);
      return json({ error: "Sessione scaduta: esci e rientra nell'app" }, 401);
    }
    const { data: me } = await admin.from("profiles").select("*").eq("user_id", who.user.id).maybeSingle();
    if (!me || !me.active || !["admin", "subadmin"].includes(me.role)) return json({ error: "Solo l'amministratrice può gestire gli account" }, 403);

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    // il sotto-admin può solo vedere l'elenco degli account
    if (me.role !== "admin" && action !== "list") return json({ error: "Solo l'amministratrice può creare o modificare gli account" }, 403);

    if (action === "list") {
      const { data: profs } = await admin.from("profiles").select("*").order("role").order("created_at");
      const out = [];
      for (const p of profs || []) {
        const { data } = await admin.auth.admin.getUserById(p.user_id);
        out.push({ ...p, last_sign_in_at: data?.user?.last_sign_in_at || null });
      }
      return json({ users: out });
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const full_name = String(body.full_name || "").trim() || email.split("@")[0];
      if (!email.includes("@")) return json({ error: "Email non valida" }, 400);
      if (password.length < 8) return json({ error: "La password deve avere almeno 8 caratteri" }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (error) {
        console.log("createUser error", error.message);
        const msg = /already|registered|exists/i.test(error.message) ? "Esiste già un account con questa email"
          : /password/i.test(error.message) ? "Password troppo debole: usa almeno 8 caratteri con lettere e numeri" : error.message;
        return json({ error: msg }, 400);
      }
      const { error: pErr } = await admin.from("profiles").insert({ user_id: data.user.id, email, full_name, role: "staff" });
      if (pErr) return json({ error: pErr.message }, 400);
      return json({ ok: true, user_id: data.user.id });
    }

    const target = String(body.user_id || "");
    if (!target) return json({ error: "Utente mancante" }, 400);
    const { data: tp } = await admin.from("profiles").select("*").eq("user_id", target).maybeSingle();
    if (!tp) return json({ error: "Utente non trovato" }, 404);
    if (tp.role === "admin") return json({ error: "L'account amministratore non può essere modificato o eliminato" }, 403);

    if (action === "set_active") {
      const active = !!body.active;
      const { error } = await admin.auth.admin.updateUserById(target, { ban_duration: active ? "none" : "876000h" });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ active }).eq("user_id", target);
      return json({ ok: true });
    }

    if (action === "rename") {
      await admin.from("profiles").update({ full_name: String(body.full_name || "").trim() }).eq("user_id", target);
      return json({ ok: true });
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(target);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Azione sconosciuta" }, 400);
  } catch (e) {
    console.log("admin-users exception", String(e));
    return json({ error: String(e) }, 500);
  }
});
