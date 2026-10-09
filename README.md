# Diva's Hairboutique — Agenda smart

Webapp installabile (PWA) per appuntamenti, promemoria, foto/audio, incassi e team.
Tutto il "motore" è su Supabase (progetto **divas-agenda**): login, database, foto/audio, promemoria automatici.
La parte visibile (i file della cartella `app`) è pubblicata su GitHub Pages, perché Supabase non ospita pagine web.

## Account
- **Amministratrice**: eriola.domi@yahoo.com — non può essere eliminata, bloccata o declassata (protezione nel database).
- **Dipendenti**: solo l'amministratrice li crea da *Impostazioni → Team → Nuovo dipendente* (nome, email, password iniziale).
  Può anche cambiare loro password, disattivarli o eliminarli. La registrazione libera dall'app non esiste.
- Tutto il team vede la stessa agenda, clienti e cassa. Ogni appuntamento ha un'**operatrice**: è lei a ricevere i promemoria.
- Solo l'amministratrice modifica listino, promemoria predefiniti e testo del messaggio alle clienti.

## Sicurezza
- **Cambia password**: Impostazioni → Il mio account → Cambia password (chiede quella attuale).
- **Password dimenticata**: dalla schermata di accesso arriva un link via email.
- **Face ID / impronta**: dopo il primo accesso l'app propone di attivarlo (o da Impostazioni). Da quel momento all'apertura,
  e dopo 5 minuti in background, si sblocca col riconoscimento del telefono. "Accedi con la password" lo azzera.

## Da fare una volta nel pannello Supabase
*Authentication → URL Configuration*: in **Site URL** e **Redirect URLs** metti l'indirizzo dell'app
(es. `https://eddynaudo.github.io/divas-agenda/`), così il link "password dimenticata" riporta all'app.
Consigliato: *Authentication → Sign In / Providers* → disattiva **Allow new users to sign up**
(i dipendenti vengono comunque creati dall'amministratrice).

## Installazione sul telefono
- **iPhone**: Safari → Condividi ⬆️ → *Aggiungi alla schermata Home* (indispensabile per le notifiche).
- **Android**: Chrome → menu ⋮ → *Installa app*.
Poi: Impostazioni → **Attiva notifiche** → *Prova notifica*.

## Promemoria
- **🔔 Operatrice (2)**: notifica push, anche ad app chiusa.
- **💬 Cliente (2)**: all'orario scelto arriva la notifica "Promemoria per Giulia": un tocco apre WhatsApp/SMS col testo pronto.
  Invio 100% automatico: attiva WhatsApp Business Cloud API (Meta) e compila `wa_token` e `wa_phone_id` nella tabella `app_secrets`
  (template approvato `promemoria_appuntamento`, 3 variabili: nome, quando, ora). Messenger non consente invii a un numero di telefono.

## Struttura
- `app/` — la webapp (nessuna build necessaria)
- `supabase/functions/send-reminders/` — invio notifiche e messaggi (ogni minuto)
- `supabase/functions/admin-users/` — gestione account dipendenti (solo admin)
