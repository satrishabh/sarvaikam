import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Kind = "privacy" | "terms" | "contact";

const copy: Record<Kind, { title: string; body: ReactNode }> = {
  privacy: {
    title: "Privacy",
    body: (
      <>
        <p>
          This draft describes what Sarvaikam Learn does with information. It is not final until
          reviewed and published.
        </p>
        <h2>What we store</h2>
        <ul>
          <li>Your account details when you register or sign in.</li>
          <li>Your learning progress, so your paths and lessons can be resumed.</li>
          <li>
            Your reading preferences, practice notes and study goal, kept in your browser's local
            storage. They are not sent to our servers.
          </li>
        </ul>
        <h2>Sessions</h2>
        <p>
          Signing in sets a refresh-token cookie that is HTTP-only and SameSite=Strict. The app
          keeps its access token in memory only.
        </p>
        <h2>Retention</h2>
        <p>[How long each record is kept, and how to delete it, to be added before publication.]</p>
        <h2>Contact</h2>
        <p>
          Questions about this policy: <Link to="/contact">contact page</Link>.
        </p>
      </>
    ),
  },
  terms: {
    title: "Terms",
    body: (
      <>
        <p>
          <strong>Draft.</strong> The terms for using Sarvaikam Learn have not been published yet.
          Until they are, the content is provided as is, for information only.
        </p>
        <h2>Contact</h2>
        <p>
          See the <Link to="/contact">contact page</Link>.
        </p>
      </>
    ),
  },
  contact: {
    title: "Contact",
    body: (
      <>
        <p>
          <strong>Draft.</strong> The support contact has not been added yet.
        </p>
        <p>[Support email to be added before publication]</p>
      </>
    ),
  },
};

export default function LegalPage({ kind }: { kind: Kind }) {
  const { title, body } = copy[kind];
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-[720px] px-5 py-12 leading-relaxed sm:px-8">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <div className="mt-6 space-y-4 text-base">{body}</div>
    </main>
  );
}
