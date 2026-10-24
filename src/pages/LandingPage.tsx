/**
 * LandingPage: the public landing page shown at `/` (Req 17.7). A Visitor or
 * Member can open it without signing in. It is rendered inside `AppLayout`, so
 * it supplies only the `<main>` content and exactly one `<h1>` (the hero
 * mission statement) per the accessibility rules.
 *
 * Required text sections (Req 17.8): what Bounty is; the local same-state
 * rule; the task workflow steps (post, apply, accept, submit work, confirm
 * completion, settle Reward); the three Reward_Types (Monetary, Nonmonetary,
 * Volunteer); and a clear note that monetary payments are simulated for the
 * demo with no real money moved. A primary "Get started" control opens the
 * sign-up form.
 *
 * All tokens come from the shared Tailwind theme (Req 17.2). All user-facing
 * text is rendered through normal JSX; `dangerouslySetInnerHTML` is never used.
 * No external images — only inline SVG / CSS shapes and decorative emoji that
 * are hidden from assistive technology. The hero band uses `brand-800` with
 * white text, which clears the 4.5:1 contrast requirement.
 *
 * Layout is responsive from 360px to 1920px: the hero text scales with
 * breakpoints, every row of chips/cards wraps or uses a responsive grid, and
 * nothing is fixed-width, so there is no horizontal scroll at any width.
 */
import { Link } from 'react-router-dom';

import { AppLayout, Card } from '../components';
import { CATEGORIES } from '../domain/constants';
import { humanize } from '../domain/labels';

/**
 * Feature-benefit strip shown below the hero. This replaces an earlier
 * "trusted by" row of example business names, which could read as real
 * endorsements even with a disclaimer. These are honest statements of what
 * Bounty offers, so they imply no false adoption claims.
 */
const BENEFITS: ReadonlyArray<{ icon: string; title: string; blurb: string }> = [
  { icon: '🤝', title: 'Help your community', blurb: 'Support local businesses and neighbors alike.' },
  { icon: '🎁', title: 'Flexible rewards', blurb: 'Offer money, goods, or a thank-you.' },
  { icon: '🎓', title: 'Build experience', blurb: 'Grow real skills and your portfolio.' },
] as const;

/** The core demo loop, as an ordered list of short step labels (Req 17.8). */
const WORKFLOW_STEPS = [
  'Post a task',
  'Browse & apply',
  'Creator accepts one applicant',
  'Assignee submits work',
  'Creator confirms completion',
  'Reward is settled',
] as const;

/** The three reward types with a one-line plain-language description. */
const REWARD_TYPES: ReadonlyArray<{ icon: string; title: string; blurb: string }> = [
  {
    icon: '💵',
    title: 'Monetary',
    blurb: 'A dollar amount, agreed in the app and settled with a demo payment.',
  },
  {
    icon: '🎁',
    title: 'Nonmonetary',
    blurb: 'A product, service, or experience — like a custom cake or free meals.',
  },
  {
    icon: '🤝',
    title: 'Volunteer',
    blurb: 'A give-back opportunity offered with no reward attached.',
  },
];

export function LandingPage() {
  return (
    <AppLayout showHomeFooter>
      {/* Hero band: full-bleed within the constrained <main> via negative
          margins that cancel the main's horizontal + top padding. A background
          photo (public/hero.jpg) sits under a ~30% dark overlay so the white
          hero text always stays readable regardless of how bright the image
          is. rand-800 is the fallback color until the image loads / if it is
          missing. Image: public/homepageBackground.png. */}
      <section
        className="relative -mx-4 -mt-8 overflow-hidden bg-brand-800 bg-cover bg-center text-surface sm:-mx-6"
        style={{ backgroundImage: "url('/homepageBackground.png')" }}
      >
        {/* Dark overlay for text contrast (~55%). Decorative only. */}
        <div aria-hidden="true" className="absolute inset-0 bg-black/30" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:py-28">
          <h1 className="text-4xl font-bold leading-tight tracking-tight drop-shadow-sm sm:text-5xl lg:text-6xl">
            Local help, powered by your community.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-surface/90 sm:text-lg">
            Bounty connects local businesses and everyday people who need
            digital help with nearby students and skilled neighbors ready to
            pitch in.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-card bg-surface px-6 py-3 text-base font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              Get started
            </Link>
            <Link
              to="/browse"
              className="inline-flex items-center justify-center rounded-card border border-surface/70 px-6 py-3 text-base font-semibold text-surface transition-colors hover:bg-surface/10"
            >
              Browse tasks
            </Link>
          </div>
        </div>
      </section>

      {/* Category pills: colorful, clearly-clickable chips into browse. */}
      <section aria-labelledby="categories-heading" className="mt-10">
        <h2 id="categories-heading" className="sr-only">
          Task categories
        </h2>
        <ul className="flex flex-wrap justify-center gap-2.5">
          {CATEGORIES.filter((c) => c !== 'other').map((category) => (
            <li key={category}>
              <Link
                to="/browse"
                className="inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-500 hover:bg-brand-100"
              >
                {humanize(category)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Feature-benefit strip: honest statements of what Bounty offers (no
          implied real-business endorsements). */}
      <section aria-labelledby="benefits-heading" className="mt-12">
        <h2 id="benefits-heading" className="sr-only">
          Why use Bounty
        </h2>
        <div className="rounded-card border border-brand-100 bg-surface-tint px-4 py-8 sm:px-8">
          <ul className="grid grid-cols-1 gap-6 text-center sm:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl"
                >
                  {benefit.icon}
                </span>
                <h3 className="mt-3 text-base font-bold text-ink">{benefit.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{benefit.blurb}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What Bounty is (Req 17.8). */}
      <section aria-labelledby="what-heading" className="mt-16">
        <h2 id="what-heading" className="text-2xl font-bold text-ink sm:text-3xl">
          What Bounty is
        </h2>
        <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-brand-600" />
        <p className="mt-3 max-w-3xl text-ink-muted">
          Bounty is a community-driven platform that connects anyone who needs
          digital help — a small business building its first website, or an
          individual who wants birthday flyers, a resume touch-up, or a social
          post designed — with nearby students and skilled people ready to pitch
          in. The work stays in your community, and helpers build real
          experience and portfolio pieces along the way.
        </p>
      </section>

      {/* Local same-state focus (Req 17.8). */}
      <section aria-labelledby="local-heading" className="mt-10">
        <Card className="border-brand-100 bg-brand-50">
          <h2
            id="local-heading"
            className="flex items-center gap-2 text-xl font-bold text-ink"
          >
            <span aria-hidden="true">📍</span>
            Local by design
          </h2>
          <p className="mt-2 max-w-3xl text-ink">
            Every task and profile belongs to one US state. You only see and
            apply to tasks in your own state, so help always comes from your
            local community.
          </p>
        </Card>
      </section>

      {/* Task workflow steps (Req 17.8). */}
      <section aria-labelledby="how-heading" className="mt-16">
        <h2 id="how-heading" className="text-2xl font-bold text-ink sm:text-3xl">
          How it works
        </h2>
        <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-brand-600" />
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW_STEPS.map((step, index) => (
            <li key={step}>
              <Card className="flex h-full items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-surface"
                >
                  {index + 1}
                </span>
                <span className="text-ink">
                  <span className="sr-only">{`Step ${index + 1}: `}</span>
                  {step}
                </span>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Three reward types (Req 17.8). */}
      <section aria-labelledby="rewards-heading" className="mt-16">
        <h2
          id="rewards-heading"
          className="text-2xl font-bold text-ink sm:text-3xl"
        >
          Rewards that fit your task
        </h2>
        <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-accent-500" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {REWARD_TYPES.map((reward) => (
            <Card key={reward.title} className="h-full">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <span aria-hidden="true">{reward.icon}</span>
                {reward.title}
              </h3>
              <p className="mt-2 text-sm text-ink-muted">{reward.blurb}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Simulated-payment note (Req 17.8). */}
      <section aria-labelledby="demo-heading" className="mt-10">
        <Card className="border-accent-100 bg-accent-50">
          <h2
            id="demo-heading"
            className="flex items-center gap-2 text-lg font-semibold text-accent-700"
          >
            <span aria-hidden="true">🔒</span>
            Payments are simulated for the demo
          </h2>
          <p className="mt-2 max-w-3xl text-ink">
            Monetary rewards are settled with a clearly labeled demo payment.
            Bounty moves no real money and never collects card or bank details.
          </p>
        </Card>
      </section>

      {/* Final call to action (Req 17.8). */}
      <section className="mb-4 mt-16 text-center">
        <h2 className="text-2xl font-bold text-ink sm:text-3xl">
          Ready to join your community?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">
          Create a free account to post a task or start helping nearby.
        </p>
        <div className="mt-6">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-card bg-brand-600 px-6 py-3 text-base font-semibold text-surface transition-colors hover:bg-brand-700"
          >
            Get started
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
