import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Datenschutz',
  robots: { index: false, follow: false },
};

export default function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung" updated="2. Juli 2026">
      <section>
        <h2>1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne der
          Datenschutz-Grundverordnung (DSGVO) ist:
          <br />
          [TODO: Name / Firmenname, Anschrift, E-Mail — siehe{' '}
          <a href="/impressum" className="text-accent underline">
            Impressum
          </a>
          ]
        </p>
      </section>

      <section>
        <h2>2. Kontoerstellung und Nutzung</h2>
        <p>
          Bei der Registrierung erheben wir E-Mail-Adresse, Passwort (verschlüsselt gespeichert,
          nie im Klartext) und optional deinen Anzeigenamen. Diese Daten werden zur
          Kontoverwaltung und Anmeldung genutzt (Art. 6 Abs. 1 lit. b DSGVO — Vertragserfüllung).
        </p>
        <p>
          Die Anmeldung erfolgt über ein signiertes Sitzungs-Cookie (JWT), das technisch notwendig
          und als HttpOnly-Cookie vor Zugriff durch clientseitiges JavaScript geschützt ist. Ein
          zusätzliches CSRF-Schutz-Cookie verhindert Cross-Site-Request-Forgery-Angriffe. Beide
          Cookies sind für den Betrieb der Plattform zwingend erforderlich (Art. 6 Abs. 1 lit. f
          DSGVO — berechtigtes Interesse an einem sicheren Betrieb) und werden nicht zu
          Tracking- oder Marketingzwecken eingesetzt.
        </p>
      </section>

      <section>
        <h2>3. Erfahrungsberichte, Bewertungen und Fragen</h2>
        <p>
          Wenn du eine Erfahrung, Bewertung oder Frage zu einem Produkt einreichst, speichern wir
          diese Inhalte zusammen mit deinem Konto, um sie anderen Nutzern anzuzeigen und den
          Wiederkauf-/Regret-Score zu berechnen (Art. 6 Abs. 1 lit. b DSGVO). Du kannst wählen,
          Erfahrungen anonymisiert (ohne sichtbaren Namen) zu veröffentlichen.
        </p>
      </section>

      <section>
        <h2>4. Fotos und Barcode-Scan</h2>
        <p>
          Beim Scannen eines Produkts per Kamera wird das Foto ausschließlich zur
          Produkterkennung an unseren KI-Anbieter übermittelt (siehe Abschnitt 6) und nicht
          dauerhaft gespeichert. Offizielle Produktbilder aus externen Katalogen (z. B.
          Herstellerdatenbanken) werden einmalig zwischengespeichert, um stabile, einheitliche
          Produktbilder anzuzeigen.
        </p>
      </section>

      <section>
        <h2>5. Push-Benachrichtigungen und E-Mail</h2>
        <p>
          Wenn du Push-Benachrichtigungen aktivierst (z. B. für Antworten auf deine Fragen),
          speichern wir dafür einen technischen Endpunkt deines Browsers. Für bestimmte
          Ereignisse (z. B. Passwort zurücksetzen, beantwortete Frage) versenden wir außerdem
          E-Mails über unseren E-Mail-Dienstleister Resend (resend.com). Beide sind jederzeit in
          deinen Kontoeinstellungen deaktivierbar bzw. betreffen nur Ereignisse, die du selbst
          ausgelöst hast.
        </p>
      </section>

      <section>
        <h2>6. Produktrecherche durch Künstliche Intelligenz</h2>
        <p>
          Um Produktdaten und öffentlich zugängliche Bewertungslagen zu recherchieren, nutzen wir
          KI-Modelle, die über den Dienstleister OpenRouter (openrouter.ai) sowie Websuche über
          Brave Search (search.brave.com) bereitgestellt werden. Dabei werden Produktnamen bzw.
          von dir eingegebene Suchanfragen an diese Dienste übermittelt. Es werden dabei keine
          personenbezogenen Kontodaten übertragen — die Anfragen betreffen ausschließlich
          Produktinformationen.
        </p>
      </section>

      <section>
        <h2>7. Hosting</h2>
        <p>
          Diese Anwendung wird bei Railway (railway.app) gehostet. Alle Datenverarbeitungen
          erfolgen auf Servern unseres Hosting-Anbieters. [TODO: Standort der Server /
          Auftragsverarbeitungsvertrag prüfen und hier ergänzen.]
        </p>
      </section>

      <section>
        <h2>8. Deine Rechte</h2>
        <p>Du hast jederzeit das Recht auf:</p>
        <ul>
          <li>Auskunft über deine bei uns gespeicherten Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung deines Kontos und deiner Daten (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        </ul>
        <p>
          Wende dich dazu an die in Abschnitt 1 genannte E-Mail-Adresse. Du hast außerdem das
          Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren.
        </p>
      </section>

      <section>
        <h2>9. Speicherdauer</h2>
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke
          erforderlich ist, oder bis du dein Konto löschst. Danach werden die Daten gelöscht oder
          anonymisiert, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
        </p>
      </section>
    </LegalPage>
  );
}
