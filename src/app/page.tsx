import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <div className="mb-10 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">LF</span>
        <span className="text-2xl font-bold">LectrFlow</span>
      </div>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Live lectures with class-level insight and a private AI tutor for every student.
      </h1>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/join"
          className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <p className="text-sm font-semibold text-indigo-600">Student</p>
          <p className="mt-1 text-xl font-semibold">Join a lecture →</p>
          <p className="mt-2 text-sm text-slate-600">Enter the code on screen, follow the slides, take notes and ask Lecture AI.</p>
        </Link>
        <Link
          href="/lecturer"
          className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <p className="text-sm font-semibold text-indigo-600">Lecturer</p>
          <p className="mt-1 text-xl font-semibold">Open lecturer console →</p>
          <p className="mt-2 text-sm text-slate-600">Run the lecture, watch confusion and questions live, get an AI insight report.</p>
        </Link>
      </div>
    </main>
  );
}
