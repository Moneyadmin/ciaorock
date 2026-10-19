import { createFileRoute, Link } from "@tanstack/react-router";
import { H2, LegalPage, List } from "@/components/LegalPage";
import { CONTROLLER, MIN_AGE } from "@/lib/legal";
import { FIND_RADIUS_M, HIDE_RADIUS_M } from "@/lib/rules";

export const Route = createFileRoute("/come-si-gioca")({
  head: () => ({
    meta: [
      { title: "Come si gioca — Ciao Rock" },
      {
        name: "description",
        content:
          "Il regolamento di Ciao Rock: come trovare e nascondere sassi dipinti, punti, badge, missioni co-op e regole di sicurezza.",
      },
    ],
  }),
  component: HowToPlayPage,
});

function HowToPlayPage() {
  return (
    <LegalPage title="Come si gioca">
      <p>
        Ciao Rock è una caccia al tesoro con i sassi dipinti: c'è chi li dipinge e li nasconde in
        giro, e chi li cerca con la mappa e gli indizi. Ogni sasso trovato finisce nella tua
        collezione, e può ripartire per un nuovo nascondiglio. Possono giocare tutti quelli che
        hanno almeno {MIN_AGE} anni.
      </p>

      <H2>🔍 Trovare un sasso</H2>
      <List>
        <li>Apri la mappa: ogni pin è un sasso nascosto. Tocca un pin per leggere l'indizio.</li>
        <li>
          Raggiungi il posto e cerca il sasso. Per registrarlo devi essere a meno di {FIND_RADIUS_M}{" "}
          metri.
        </li>
        <li>
          Scatta una foto-prova del sasso: l'AI controlla che sia proprio quello registrato. La foto
          la vedi solo tu (e gli amministratori).
        </li>
        <li>
          Prendi i punti del sasso, una volta sola per ogni sasso. Non puoi trovare i sassi che hai
          creato tu.
        </li>
        <li>
          Poi puoi votare quanto è stato difficile trovarlo (da 0 a 5) e lasciare un commento: i
          voti aiutano a rendere giusti i punti del sasso.
        </li>
      </List>

      <H2>🎨 Nascondere un sasso</H2>
      <List>
        <li>Dipingi un sasso: una faccia, un animale, un disegno, quello che vuoi.</li>
        <li>
          Scatta la foto del sasso dipinto: l'AI controlla che si veda il disegno. Inquadra solo il
          sasso, senza persone né dati personali (targhe, indirizzi).
        </li>
        <li>
          Puoi nasconderlo solo dove ti trovi: il nascondiglio deve essere entro {HIDE_RADIUS_M}{" "}
          metri da te.
        </li>
        <li>
          Dagli un nome e scrivi un indizio per trovarlo, poi scegli la difficoltà. Nome e indizio
          vengono controllati: niente dati personali, parolacce o luoghi privati.
        </li>
        <li>
          L'AI legge l'indizio e decide quanti punti vale il sasso, da 50 a 2.000 punti. Dopo almeno
          3 voti dei giocatori che l'hanno trovato, i punti si aggiustano in base a quanto è stato
          davvero difficile.
        </li>
      </List>

      <H2>🔁 Far viaggiare i sassi</H2>
      <List>
        <li>
          Un sasso che hai trovato (o che hai creato) lo puoi spostare in un nuovo nascondiglio.
        </li>
        <li>
          Devi averlo in mano (entro {FIND_RADIUS_M} metri da dove si trova) e il nuovo nascondiglio
          deve essere entro {HIDE_RADIUS_M} metri da te.
        </li>
        <li>
          Fai una nuova foto del sasso e scrivi un nuovo indizio. Il sasso conta i suoi viaggi!
        </li>
      </List>

      <H2>⭐ I punti</H2>
      <List>
        <li>
          <strong>Trovare un sasso:</strong> i punti del sasso.
        </li>
        <li>
          <strong>Nascondere un sasso:</strong> 15 punti.
        </li>
        <li>
          <strong>Bonus creatore:</strong> ogni volta che qualcun altro trova un tuo sasso, ricevi
          metà dei punti che prende chi lo trova.
        </li>
        <li>
          <strong>Bonus del giorno:</strong> 15 punti al primo accesso di ogni giorno.
        </li>
        <li>
          <strong>Serie:</strong> entra nel gioco più giorni di fila per allungare la tua serie e
          sbloccare i badge della categoria Serie.
        </li>
        <li>
          <strong>Giornate speciali:</strong> in alcuni giorni annunciati sulla mappa tutti i punti
          valgono doppio (o di più).
        </li>
      </List>

      <H2>🤝 Missioni co-op</H2>
      <List>
        <li>
          Puoi sfidare un amico a una missione: scegli un sasso che nessuno dei due ha già trovato e
          che non avete creato voi.
        </li>
        <li>L'amico ha 10 minuti per accettare. Si fa una missione alla volta.</li>
        <li>
          Dall'accettazione avete 30 minuti: se lo trovate entrambi in tempo, tutti i punti dei
          sassi che avete trovato durante la missione valgono doppio.
        </li>
        <li>Se il tempo scade, la missione non riesce, ma i punti normali restano.</li>
      </List>

      <H2>🏅 Badge, classifica e negozio</H2>
      <List>
        <li>
          I badge si sbloccano da soli: per i sassi trovati e creati, per l'ora in cui trovi un
          sasso, per le serie di giorni e per i sassi trovati nella stessa città, regione o nazione.
        </li>
        <li>
          Ogni tanto arrivano badge e targhette speciali, anche a tempo limitato: si sbloccano
          completando una sfida o si comprano nel negozio. Finito il periodo spariscono dal negozio,
          ma chi li ha ottenuti li tiene.
        </li>
        <li>
          Nel negozio spendi il tuo saldo per le targhette da mostrare sotto il nickname. Spendere
          non ti fa scendere in classifica: la classifica conta tutti i punti guadagnati.
        </li>
        <li>Punti, badge e targhette non valgono soldi e non si comprano con soldi veri.</li>
      </List>

      <H2>💬 Amici e messaggi</H2>
      <List>
        <li>Cerca gli altri giocatori per nickname e mandagli una richiesta di amicizia.</li>
        <li>I messaggi si possono scambiare solo tra amici.</li>
        <li>La tua posizione non è mai mostrata a nessuno, nemmeno agli amici.</li>
      </List>

      <H2>🛡️ Gioca in sicurezza</H2>
      <List>
        <li>
          Nascondi e cerca sassi solo in luoghi pubblici e sicuri, meglio se con un adulto o amici.
        </li>
        <li>
          Non nascondere sassi vicino a casa tua o alla tua scuola: chi trova il sasso vede la
          posizione e il tuo nickname.
        </li>
        <li>
          Non entrare in proprietà private e stai lontano da strade trafficate, binari e acqua alta.
        </li>
        <li>
          Non dare a nessuno numero di telefono, indirizzo, scuola o profili social, e non
          incontrare di persona chi conosci solo dall'app.
        </li>
        <li>
          Rispetta l'ambiente: niente sassi in aree protette e niente danni a piante e monumenti.
        </li>
      </List>

      <H2>🚫 Fair play</H2>
      <p>
        Niente trucchi: foto non tue, posizioni false, più account o ritrovamenti inventati portano
        al blocco dell'account. Le regole complete sono nei{" "}
        <Link to="/termini" className="font-bold underline">
          termini d'uso
        </Link>
        . Hai visto qualcosa che non va? Scrivici a {CONTROLLER.email}.
      </p>
    </LegalPage>
  );
}
