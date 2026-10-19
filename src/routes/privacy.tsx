import { createFileRoute } from "@tanstack/react-router";
import { H2, LegalPage, List } from "@/components/LegalPage";
import { CONTROLLER, EMAIL_PROVIDER, MIN_AGE, TERMS_VERSION } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Informativa privacy — Ciao Rock" }] }),
  component: PrivacyPage,
});

const updated = new Date(TERMS_VERSION).toLocaleDateString("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function PrivacyPage() {
  const c = CONTROLLER;
  return (
    <LegalPage title="Informativa privacy" updated={updated}>
      <p>
        Questa informativa spiega quali dati raccoglie Ciao Rock, perché, a chi li affida e quali
        diritti hai (artt. 13 e 14 del Regolamento UE 2016/679, "GDPR"). Abbiamo cercato di
        scriverla in modo semplice: se qualcosa non è chiaro, scrivici.
      </p>

      <H2>Chi è il titolare</H2>
      <p>
        {c.name}, {c.address}, P. IVA {c.vat}. Per qualsiasi domanda o richiesta sulla privacy:{" "}
        <a href={`mailto:${c.email}`} className="font-bold underline">
          {c.email}
        </a>
        .
      </p>

      <H2>Età minima</H2>
      <p>
        Ciao Rock è riservato a chi ha almeno {MIN_AGE} anni. All'iscrizione chiediamo la data di
        nascita solo per verificarlo: non la salviamo, conserviamo soltanto la conferma che hai
        almeno {MIN_AGE} anni e la data in cui hai accettato questa informativa e i termini. Se sei
        un genitore e pensi che tuo figlio con meno di {MIN_AGE} anni si sia iscritto, scrivici e
        cancelliamo l'account.
      </p>

      <H2>Quali dati trattiamo</H2>
      <List>
        <li>
          <strong>Account:</strong> email e password (la password è conservata cifrata e non la
          vediamo).
        </li>
        <li>
          <strong>Profilo:</strong> nickname, e se li aggiungi biografia, foto profilo e targhetta.
        </li>
        <li>
          <strong>Sassi che nascondi:</strong> foto del sasso, nome, indizio, difficoltà e posizione
          del nascondiglio.
        </li>
        <li>
          <strong>Sassi che trovi:</strong> foto-prova, data e ora, e il luogo in forma generica
          (città, regione, nazione, continente). Le coordinate precise del ritrovamento non vengono
          salvate.
        </li>
        <li>
          <strong>Attività di gioco:</strong> punti, serie di giorni, badge, premi, acquisti fatti
          con i punti, voti e commenti sui sassi, missioni co-op.
        </li>
        <li>
          <strong>Amicizie e messaggi</strong> con i tuoi amici.
        </li>
        <li>
          <strong>Posizione del telefono:</strong> la usiamo sul tuo dispositivo per la mappa e per
          calcolare la distanza dai sassi. Viene inviata ai nostri server solo quando crei, trovi o
          sposti un sasso, per verificare che tu sia davvero lì, e non viene conservata (restano
          solo la posizione del sasso e la città del ritrovamento). Non è mai mostrata ad altri
          giocatori.
        </li>
        <li>
          <strong>Dati tecnici:</strong> indirizzo IP, tipo di dispositivo e registri tecnici
          generati dai fornitori di hosting e database, usati per far funzionare e proteggere il
          servizio.
        </li>
      </List>
      <p>
        Nel browser salviamo solo dati tecnici necessari (sessione di accesso, preferenze, azioni in
        attesa quando sei offline). Non usiamo cookie o strumenti di pubblicità, profilazione o
        statistica di terze parti.
      </p>

      <H2>Cosa vedono gli altri giocatori</H2>
      <List>
        <li>Nickname, foto profilo, bio, targhetta, badge, punti e posizione in classifica.</li>
        <li>
          I sassi che nascondi (foto, nome, indizio, posizione) con il tuo nickname come creatore.
        </li>
        <li>Quanti sassi hai trovato e in quali città.</li>
        <li>
          Le tue <strong>foto-prova non sono visibili</strong> agli altri giocatori: le vedi solo tu
          e, se serve per controlli, gli amministratori.
        </li>
        <li>I messaggi si possono scambiare solo tra amici e li vedete solo voi due.</li>
      </List>

      <H2>Perché li trattiamo e su quale base</H2>
      <List>
        <li>
          <strong>Far funzionare il gioco</strong> (account, mappa, sassi, punti, amici, chat):
          esecuzione del servizio che hai richiesto accettando i termini (art. 6.1.b GDPR).
        </li>
        <li>
          <strong>Sicurezza, prevenzione di abusi e tutela dei minori</strong> (controllo di foto e
          testi, verifica dell'età, blocco di account che violano le regole): legittimo interesse
          nostro e degli altri giocatori (art. 6.1.f) e obblighi di legge (art. 8 GDPR e art.
          2-quinquies del Codice privacy).
        </li>
        <li>
          <strong>Email di servizio</strong> (accesso, recupero password, comunicazioni importanti
          sul gioco): esecuzione del servizio. Non ti mandiamo pubblicità.
        </li>
      </List>

      <H2>Controlli automatici con l'intelligenza artificiale</H2>
      <p>
        Per tenere Ciao Rock sicuro e corretto usiamo servizi di intelligenza artificiale, tramite
        la piattaforma OpenRouter, Inc. (Stati Uniti), che inoltra le richieste a modelli di Google
        (Gemini) e di OpenAI. L'AI riceve:
      </p>
      <List>
        <li>
          le <strong>foto</strong> dei sassi e le foto-prova, per verificare che mostrino un sasso
          dipinto (o lo stesso sasso registrato), e le foto profilo, per verificare che non
          contengano contenuti inadatti o dati personali leggibili;
        </li>
        <li>
          i <strong>testi pubblici</strong> (nickname, bio, nome e indizio dei sassi, commenti sui
          sassi), per bloccare volgarità, contenuti inadatti, dati personali e inviti a vedersi
          fuori dall'app;
        </li>
        <li>gli indizi e i commenti, anche per stimare la difficoltà e i punti dei sassi.</li>
      </List>
      <p>
        Non inviamo all'AI la tua email, la tua posizione né i messaggi privati. Abbiamo configurato
        il servizio perché i fornitori non usino i dati per addestrare i loro modelli. Se l'AI
        rifiuta una foto o un testo puoi modificarlo e riprovare; se pensi che il rifiuto sia
        sbagliato scrivici a {c.email} e una persona lo riesaminerà.
      </p>

      <H2>A chi affidiamo i dati</H2>
      <p>
        I dati sono trattati da fornitori che agiscono per nostro conto come responsabili del
        trattamento (art. 28 GDPR):
      </p>
      <List>
        <li>Supabase, Inc.: database, accesso e archiviazione delle foto profilo;</li>
        <li>Cloudflare, Inc.: hosting dell'app e rete di distribuzione;</li>
        <li>{EMAIL_PROVIDER}: invio delle email di servizio;</li>
        <li>
          OpenRouter, Inc. e, tramite questo, Google LLC e OpenAI: controlli AI descritti sopra;
        </li>
        <li>
          OpenStreetMap Foundation (servizio Nominatim): riceve dal nostro server le coordinate del
          punto in cui trovi un sasso, per ricavare il nome della città, senza dati che ti
          identificano;
        </li>
        <li>
          OpenFreeMap e OpenStreetMap: forniscono le immagini della mappa e ricevono l'indirizzo IP
          del tuo dispositivo quando la mappa viene caricata.
        </li>
      </List>
      <p>
        Alcuni di questi fornitori hanno sede negli Stati Uniti. I trasferimenti avvengono sulla
        base del Data Privacy Framework UE-USA o delle clausole contrattuali standard approvate
        dalla Commissione europea. Non vendiamo i tuoi dati a nessuno.
      </p>

      <H2>Per quanto tempo</H2>
      <p>
        Conserviamo i dati finché il tuo account esiste. Puoi eliminarlo quando vuoi dal tuo profilo
        ("Elimina il mio account"): cancelliamo subito profilo, foto, ritrovamenti, messaggi,
        amicizie, punti e premi. I sassi che hai nascosto e che altri giocatori hanno già trovato
        restano nel gioco senza il tuo nome; gli altri vengono cancellati. Le copie di sicurezza dei
        fornitori vengono sovrascritte entro poche settimane. Per proteggere il servizio possiamo
        conservare più a lungo solo ciò che serve a far valere un ban o a rispondere a richieste
        delle autorità.
      </p>

      <H2>I tuoi diritti</H2>
      <p>
        Puoi chiederci di accedere ai tuoi dati, correggerli, cancellarli, limitarne l'uso,
        riceverli in un formato leggibile (portabilità) o opporti al loro trattamento, scrivendo a{" "}
        {c.email}. Rispondiamo entro un mese. Hai anche il diritto di presentare reclamo al Garante
        per la protezione dei dati personali (www.garanteprivacy.it).
      </p>

      <H2>Sicurezza</H2>
      <p>
        Usiamo connessioni cifrate, accessi limitati ai soli amministratori e regole nel database
        che impediscono ai giocatori di leggere o modificare dati che non li riguardano.
      </p>

      <H2>Modifiche</H2>
      <p>
        Se cambiamo questa informativa in modo importante te lo diremo nell'app e ti chiederemo di
        accettarla di nuovo.
      </p>
    </LegalPage>
  );
}
