import { createFileRoute, Link } from "@tanstack/react-router";
import { H2, LegalPage, List } from "@/components/LegalPage";
import { CONTROLLER, MIN_AGE, TERMS_VERSION } from "@/lib/legal";

export const Route = createFileRoute("/termini")({
  head: () => ({ meta: [{ title: "Termini d'uso — Ciao Rock" }] }),
  component: TermsPage,
});

const updated = new Date(TERMS_VERSION).toLocaleDateString("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function TermsPage() {
  const c = CONTROLLER;
  return (
    <LegalPage title="Termini d'uso" updated={updated}>
      <p>
        Ciao Rock è un gioco gratuito in cui si dipingono, nascondono e cercano sassi in luoghi
        pubblici. È gestito da {c.name} ({c.address}, P. IVA {c.vat}). Usando l'app accetti queste
        regole; per come trattiamo i dati leggi l'
        <Link to="/privacy" className="font-bold underline">
          informativa privacy
        </Link>
        .
      </p>

      <H2>Chi può giocare</H2>
      <p>
        Devi avere almeno {MIN_AGE} anni. Se sei minorenne, parlane con i tuoi genitori: le uscite
        per nascondere e cercare sassi avvengono sotto la loro responsabilità. Ogni persona può
        avere un solo account e deve tenere per sé la password.
      </p>

      <H2>Regole di sicurezza</H2>
      <List>
        <li>Nascondi e cerca sassi solo in luoghi pubblici, sicuri e accessibili a tutti.</li>
        <li>
          Non entrare in proprietà private, cantieri, binari, strade trafficate o zone pericolose, e
          non nascondere sassi vicino a casa tua o alla tua scuola.
        </li>
        <li>
          Non incontrare di persona chi conosci solo tramite l'app e non dare a nessuno numero di
          telefono, indirizzo, scuola o profili social.
        </li>
        <li>Fai attenzione al traffico e non usare il telefono mentre attraversi la strada.</li>
        <li>
          Rispetta l'ambiente: non danneggiare piante, monumenti o arredi urbani, non lasciare sassi
          in aree protette e usa colori adatti all'esterno.
        </li>
      </List>

      <H2>Cosa non è permesso</H2>
      <List>
        <li>
          Pubblicare foto o testi volgari, offensivi, violenti, sessuali, discriminatori o che
          mostrano persone o dati personali (tuoi o di altri).
        </li>
        <li>Molestare, prendere in giro o minacciare altri giocatori.</li>
        <li>
          Barare: registrare ritrovamenti falsi, usare foto non tue, falsificare la posizione o
          creare più account.
        </li>
        <li>Usare l'app per pubblicità, spam o per contattare giocatori fuori dal gioco.</li>
      </List>
      <p>
        Foto e testi vengono controllati anche in automatico. Possiamo rimuovere contenuti e
        sospendere o chiudere gli account che non rispettano queste regole. Se vedi qualcosa che non
        va, scrivici a {c.email}.
      </p>

      <H2>I tuoi contenuti</H2>
      <p>
        Foto, nomi e indizi che pubblichi restano tuoi. Ci autorizzi a mostrarli nell'app agli altri
        giocatori finché restano nel gioco. Pubblica solo foto scattate da te e contenuti di cui hai
        i diritti.
      </p>

      <H2>Punti, premi e negozio</H2>
      <p>
        Punti, badge e targhette sono solo per il gioco: non hanno valore in denaro, non si comprano
        con soldi veri e non si possono cambiare in denaro o premi reali. Possiamo modificare
        regole, punteggi e premi per tenere il gioco equilibrato.
      </p>

      <H2>Servizio e responsabilità</H2>
      <p>
        Facciamo del nostro meglio perché l'app funzioni, ma può avere interruzioni o errori e
        possiamo cambiarla o chiuderla con un preavviso ragionevole. Non siamo responsabili di
        quello che succede durante le uscite all'aperto, che restano sotto la responsabilità di chi
        gioca (e dei genitori, per i minorenni), salvo i casi previsti dalla legge.
      </p>

      <H2>Chiudere l'account</H2>
      <p>
        Puoi eliminare l'account in qualsiasi momento dal tuo profilo. Possiamo chiuderlo noi in
        caso di violazioni gravi o ripetute di queste regole.
      </p>

      <H2>Modifiche e legge applicabile</H2>
      <p>
        Se cambiamo questi termini in modo importante ti chiederemo di accettarli di nuovo. Si
        applica la legge italiana; restano salvi i diritti che ti riconosce la legge a tutela dei
        consumatori, compreso il foro del luogo in cui risiedi.
      </p>
    </LegalPage>
  );
}
