import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Category } from '../api';
import { useSkills } from '../components/SkillMap';

const trackDetails: Record<string, { icon: string; tag: string; color: string }> = {
  'behavioral-interviews': { icon: '✳', tag: 'People & stories', color: 'from-[#f9a47d] to-[#f35d5b]' },
  'coding-interviews': { icon: '</>', tag: 'Problem solving', color: 'from-[#9f9af7] to-[#6c63e8]' },
  'system-design-interviews': { icon: '◈', tag: 'Architecture', color: 'from-[#69d6c6] to-[#168d88]' },
  'sql-interviews': { icon: '⌘', tag: 'Data & queries', color: 'from-[#f2cb72] to-[#ee9645]' },
  'devops-cloud-interviews': { icon: '↗', tag: 'Cloud & operations', color: 'from-[#86baff] to-[#4a7de2]' },
};

const warmup = [
  { day: '01', title: 'Know your story', detail: 'Draft your introduction and choose two STAR examples.' },
  { day: '02', title: 'Think out loud', detail: 'Clarify a coding prompt, then solve and test it.' },
  { day: '03', title: 'Design the shape', detail: 'Scope a system and sketch its main data flow.' },
  { day: '04', title: 'Query the data', detail: 'Practise joins, grouping, and one window function.' },
  { day: '05', title: 'Operate with care', detail: 'Talk through a production incident and safe recovery.' },
  { day: '06', title: 'Run a mock', detail: 'Ask a partner to challenge your assumptions.' },
  { day: '07', title: 'Review & reset', detail: 'Repeat the hardest drill and write down what improved.' },
];

export default function InterviewPrepPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState('');
  const { skills, signedIn } = useSkills(categories ?? []);

  useEffect(() => {
    api.categories().then(setCategories).catch((e: Error) => setError(e.message));
  }, []);

  const category = categories?.find((item) => item.slug === 'interview-preparation');
  const skill = useMemo(() => skills.find((item) => item.slug === 'interview-preparation'), [skills]);
  const totalLessons = category?.topics.reduce((total, topic) => total + topic.lessonCount, 0) ?? 0;
  const completedLessons = skill?.done ?? 0;
  const completion = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <h1 className="text-3xl font-semibold">Your prep room couldn't load</h1>
        <p className="mt-2 text-muted">{error}</p>
        <Link to="/" className="link mt-4 inline-block">Back to Explore</Link>
      </div>
    );
  }

  return (
    <div className="space-y-14 sm:space-y-20">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#111522] px-6 py-10 text-white sm:px-12 sm:py-14">
        <div aria-hidden className="absolute -right-20 -top-32 -z-10 h-96 w-96 rounded-full bg-[#f36e57]/35 blur-3xl" />
        <div aria-hidden className="absolute -bottom-48 right-1/4 -z-10 h-80 w-80 rounded-full bg-[#726cf0]/40 blur-3xl" />
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_.8fr]">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] font-medium uppercase tracking-[.16em] text-white/75">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[#ff9a73]" />
              The interview prep room
            </p>
            <h1 className="mt-6 font-display text-[42px] font-semibold leading-[1.02] tracking-tightest sm:text-[64px]">
              Make your next<br className="hidden sm:block" /> interview your best one.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/70 sm:text-[19px]">
              A practical warm-up for the stories you tell, the problems you solve, and the systems you design.
              Learn a little. Practise out loud. Get sharper every round.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#tracks" className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#ff8c68] px-6 text-[15px] font-semibold text-[#231816] transition-transform hover:-translate-y-0.5">
                Pick your first drill <span aria-hidden className="ml-2">↘</span>
              </a>
              <span className="text-[14px] text-white/55">No cram session required.</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[340px] animate-rise">
            <div className="absolute inset-3 rotate-6 rounded-[2rem] bg-gradient-to-br from-[#ffab78]/70 to-[#8078f5]/70 blur-sm" />
            <div className="relative rotate-[-3deg] rounded-[1.75rem] border border-white/15 bg-[#1d2232]/95 p-5 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between text-[12px] font-medium uppercase tracking-[.18em] text-white/50">
                <span>Practice mode</span><span className="text-[#ffab78]">● Live</span>
              </div>
              <div className="mt-8 font-display text-[22px] font-semibold leading-snug">Tell me about a time you changed your mind.</div>
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[.06] p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff8c68]/15 text-[#ffab78]">✳</span>
                <div>
                  <p className="text-[13px] font-medium text-white/85">Your story, your words</p>
                  <p className="text-[12px] text-white/45">Context → choice → learning</p>
                </div>
              </div>
              <div className="mt-5 flex items-end gap-1.5" aria-hidden>
                {[22, 38, 28, 48, 34, 56, 32, 44, 25, 50, 37, 61, 31, 45, 24].map((height, index) => (
                  <span key={index} className={`w-full rounded-full ${index === 11 ? 'bg-[#ff9a73]' : 'bg-white/20'}`} style={{ height }} />
                ))}
              </div>
              <p className="mt-2 text-right text-[11px] text-white/35">A strong answer sounds like you.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
        <div className="surface flex flex-col justify-between p-6 sm:p-8">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[.15em] text-accent">Your starting point</p>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight">Small reps. Real confidence.</h2>
            <p className="mt-3 text-[16px] text-muted">
              {signedIn
                ? `${completedLessons} of ${totalLessons} prep drills complete. Keep your momentum going.`
                : 'Work through a track at your own pace. Sign in when you want your progress saved.'}
            </p>
          </div>
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-[14px]">
              <span className="font-medium">Prep progress</span>
              <span className="tabular-nums text-muted">
                {signedIn ? `${completion}%` : categories ? `${totalLessons} guided drills` : 'Loading guided drills'}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full bg-gradient-to-r from-[#f3a277] to-[#766df0] transition-[width] duration-700" style={{ width: `${signedIn ? completion : 8}%` }} />
            </div>
            {!signedIn && <Link to="/login" className="link mt-4 inline-block text-[14px]">Sign in to save your progress →</Link>}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-[#eeedf9] p-6 sm:p-8">
          <p className="text-[13px] font-semibold uppercase tracking-[.15em] text-[#6154bc]">A 7-day warm-up</p>
          <h2 className="mt-2 text-[26px] font-semibold leading-tight">A little structure goes a long way.</h2>
          <div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {warmup.map((item) => (
              <div key={item.day} className="flex gap-3">
                <span className="font-mono text-[13px] font-semibold text-[#796fd0]">{item.day}</span>
                <div>
                  <h3 className="text-[15px] font-semibold">{item.title}</h3>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tracks" className="scroll-mt-24">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[.15em] text-accent">Choose your focus</p>
            <h2 className="mt-2 text-[32px] font-semibold tracking-tightest sm:text-[38px]">Five tracks. One stronger you.</h2>
          </div>
          <span className="text-[15px] text-muted">{totalLessons} short, practical drills</span>
        </div>

        {!category
          ? <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-44" />)}</div>
          : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {category.topics.map((topic, index) => {
                const detail = trackDetails[topic.slug] ?? { icon: '✦', tag: 'Interview skills', color: 'from-[#9f9af7] to-[#6c63e8]' };
                const topicSkill = skill?.topics.find((item) => item.slug === topic.slug);
                const done = topicSkill?.done ?? 0;
                const percent = topicSkill?.total ? Math.round((done / topicSkill.total) * 100) : 0;
                return (
                  <Link key={topic.slug} to={`/topics/${topic.slug}`} className="group surface relative overflow-hidden p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-ink/5">
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${detail.color}`} />
                    <div className="flex items-start justify-between gap-3">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${detail.color} text-[20px] font-semibold text-white shadow-lg shadow-ink/10`}>
                        {detail.icon}
                      </span>
                      <span className="rounded-full bg-track px-3 py-1 text-[12px] font-medium text-muted">{detail.tag}</span>
                    </div>
                    <p className="mt-6 text-[12px] font-semibold uppercase tracking-[.14em] text-muted">Track 0{index + 1}</p>
                    <h3 className="mt-1 text-[22px] font-semibold leading-snug group-hover:text-accent">{topic.name}</h3>
                    <p className="mt-2 min-h-[48px] text-[14px] leading-relaxed text-muted">{topic.summary}</p>
                    <div className="mt-5 flex items-center justify-between text-[13px]">
                      <span className="text-muted">{topic.lessonCount} drills</span>
                      {signedIn
                        ? <span className="font-medium tabular-nums">{done}/{topic.lessonCount} complete</span>
                        : <span className="font-semibold text-accent">Explore track <span aria-hidden>→</span></span>}
                    </div>
                    {signedIn && <div className="mt-2 h-1 overflow-hidden rounded-full bg-track"><div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} /></div>}
                  </Link>
                );
              })}
            </div>}
      </section>

      <section className="rounded-2xl bg-[#141927] px-6 py-8 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-9">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[.15em] text-[#ffab78]">The best prep is personal</p>
          <h2 className="mt-2 text-[25px] font-semibold leading-tight">Use your own notes. Practise with your own examples.</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-white/60">Bring the job description and the stories only you can tell. The framework is here to help you prepare—not to answer for you.</p>
        </div>
        <Link to="/" className="btn mt-6 shrink-0 bg-white text-ink hover:bg-white/90 sm:mt-0">Explore all learning paths</Link>
      </section>
    </div>
  );
}
