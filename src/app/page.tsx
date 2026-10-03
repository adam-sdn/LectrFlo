import Image from "next/image";
import Link from "next/link";

const ENTRY =
  "group flex flex-col border border-slate-300 bg-white p-8 transition hover:border-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <Image src="/brand/lectrflo-logo.png" alt="LectrFlo" width={220} height={164} priority className="mb-12 h-auto w-44 sm:w-52" />
      <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">The live lecture, reimagined</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold text-slate-900 sm:text-5xl">
        Class-level insight for lecturers. A private AI tutor for every student.
      </h1>
      <div className="mt-12 grid gap-px border border-slate-300 bg-slate-300 sm:grid-cols-2">
        <Link href="/join" className={ENTRY}>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Student</p>
          <p className="mt-3 font-display text-2xl font-semibold text-slate-900">Join a lecture</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Enter the code on screen, follow the slides, take notes and ask Lecture AI.</p>
          <span className="mt-6 text-sm font-semibold text-indigo-600 group-hover:underline">Enter a code →</span>
        </Link>
        <Link href="/lecturer" className={ENTRY}>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Lecturer</p>
          <p className="mt-3 font-display text-2xl font-semibold text-slate-900">Run a lecture</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Present live, see confusion and questions as they happen, and get an AI insight report.</p>
          <span className="mt-6 text-sm font-semibold text-indigo-600 group-hover:underline">Open the console →</span>
        </Link>
      </div>
    </main>
  );
}
