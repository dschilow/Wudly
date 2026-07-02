import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'AGB',
  robots: { index: false, follow: false },
};

export default function AgbPage() {
  return (
    <LegalPage title="Allgemeine Geschäftsbedingungen" updated="2. Juli 2026">
      <section>
        <h2>1. Geltungsbereich</h2>
        <p>
          Diese Nutzungsbedingungen gelten für die Nutzung der Plattform Wudly (nachfolgend
          „Wudly", „wir", „uns"), betrieben von [TODO: Name / Firmenname, siehe{' '}
          <a href="/impressum" className="text-accent underline">
            Impressum
          </a>
          ], durch registrierte und nicht registrierte Nutzer (nachfolgend „Nutzer", „du").
        </p>
      </section>

      <section>
        <h2>2. Leistungsbeschreibung</h2>
        <p>
          Wudly ist eine kostenlose Plattform, auf der Nutzer echte Erfahrungen zu Produkten nach
          echter Nutzung teilen — insbesondere, ob sie das Produkt wieder kaufen würden
          („Wiederkauf-Score"). Wudly vermittelt keine Käufe, ist kein Vertragspartner bei
          Produktkäufen und übernimmt keine Garantie- oder Rückgabeabwicklung für die bewerteten
          Produkte.
        </p>
      </section>

      <section>
        <h2>3. Registrierung und Konto</h2>
        <p>
          Für bestimmte Funktionen (Erfahrungen teilen, Fragen stellen/beantworten) ist eine
          Registrierung mit gültiger E-Mail-Adresse erforderlich. Du bist verpflichtet, wahre
          Angaben zu machen und dein Passwort geheim zu halten. Ein Konto ist nicht übertragbar.
        </p>
      </section>

      <section>
        <h2>4. Nutzergenerierte Inhalte</h2>
        <p>
          Mit dem Einreichen von Erfahrungsberichten, Bewertungen, Fragen oder Antworten
          („Inhalte") räumst du Wudly das nicht-exklusive, zeitlich und räumlich unbeschränkte
          Recht ein, diese Inhalte auf der Plattform anzuzeigen, zu verarbeiten und in
          aggregierter Form (z. B. Scores, Statistiken) darzustellen.
        </p>
        <p>Du versicherst, dass deine Inhalte:</p>
        <ul>
          <li>wahrheitsgemäß sind und auf eigener, echter Nutzung des Produkts beruhen</li>
          <li>keine Rechte Dritter verletzen (Urheber-, Marken-, Persönlichkeitsrechte)</li>
          <li>keine beleidigenden, diskriminierenden oder rechtswidrigen Inhalte enthalten</li>
          <li>nicht im Auftrag eines Herstellers oder gegen Bezahlung ohne Kennzeichnung verfasst wurden</li>
        </ul>
        <p>
          Wudly behält sich vor, Inhalte, die gegen diese Bedingungen verstoßen, ohne Vorankündigung
          zu entfernen und Konten bei wiederholten Verstößen zu sperren.
        </p>
      </section>

      <section>
        <h2>5. Wudly Showcase (Hersteller-/Creator-Inhalte)</h2>
        <p>
          Neben nutzergenerierten Erfahrungen bietet Wudly einen gesondert gekennzeichneten
          Bereich für professionelle Hersteller- und Creator-Inhalte („Wudly Showcase"). Diese
          Inhalte sind klar als solche markiert und fließen zu keinem Zeitpunkt in den
          Wiederkauf-Score oder die Rankings ein.
        </p>
      </section>

      <section>
        <h2>6. Haftung</h2>
        <p>
          Wudly stellt lediglich die technische Plattform bereit und macht sich die von Nutzern
          eingereichten Inhalte nicht zu eigen. Für die Richtigkeit, Vollständigkeit und Aktualität
          der von Nutzern geteilten Erfahrungen übernehmen wir keine Gewähr. Kaufentscheidungen auf
          Basis von Wudly-Inhalten treffen Nutzer eigenverantwortlich.
        </p>
        <p>
          Wudly haftet nur für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung wesentlicher
          Vertragspflichten (Kardinalpflichten) für vorhersehbare, vertragstypische Schäden, soweit
          gesetzlich zulässig.
        </p>
      </section>

      <section>
        <h2>7. Kündigung / Kontolöschung</h2>
        <p>
          Du kannst dein Konto jederzeit ohne Angabe von Gründen löschen lassen. Wende dich dazu an
          die im Impressum genannte E-Mail-Adresse. Wudly kann Konten bei Verstößen gegen diese
          Bedingungen sperren oder löschen.
        </p>
      </section>

      <section>
        <h2>8. Änderungen dieser Bedingungen</h2>
        <p>
          Wir behalten uns vor, diese Bedingungen bei Bedarf anzupassen, etwa bei neuen Funktionen
          oder rechtlichen Anforderungen. Über wesentliche Änderungen informieren wir registrierte
          Nutzer angemessen.
        </p>
      </section>

      <section>
        <h2>9. Schlussbestimmungen</h2>
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
          UN-Kaufrechts. Sollte eine Bestimmung dieser Bedingungen unwirksam sein, bleibt die
          Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </section>
    </LegalPage>
  );
}
