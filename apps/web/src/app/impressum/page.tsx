import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Impressum',
  robots: { index: false, follow: false },
};

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum" updated="2. Juli 2026">
      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          [TODO: Vollständiger Name / Firmenname]
          <br />
          [TODO: Straße und Hausnummer]
          <br />
          [TODO: Postleitzahl und Ort]
          <br />
          [TODO: Land]
        </p>
      </section>

      <section>
        <h2>Kontakt</h2>
        <p>
          Telefon: [TODO: Telefonnummer]
          <br />
          E-Mail: [TODO: hallo@wudly.app]
        </p>
      </section>

      <section>
        <h2>Umsatzsteuer-ID</h2>
        <p>
          Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:
          <br />
          [TODO: USt-IdNr. oder „Nicht vorhanden — Kleinunternehmerregelung § 19 UStG"]
        </p>
      </section>

      <section>
        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>
          [TODO: Name, Anschrift wie oben]
        </p>
      </section>

      <section>
        <h2>Streitschlichtung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          . Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht verpflichtet und nicht
          bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      <section>
        <h2>Haftung für Inhalte</h2>
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach
          den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter
          jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen
          oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        </p>
        <p>
          Wudly ist eine Plattform für nutzergenerierte Inhalte (Erfahrungsberichte, Bewertungen,
          Fragen und Antworten). Bei Bekanntwerden entsprechender Rechtsverletzungen werden wir diese
          Inhalte umgehend entfernen.
        </p>
      </section>
    </LegalPage>
  );
}
