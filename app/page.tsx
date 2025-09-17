'use client';

export default function Home() {
  return (
    <main className="p-8 space-y-3">
      <h1 className="text-2xl font-semibold">Build check </h1>
      <p className="text-neutral-400">
        You are on: <code className="px-2 py-1 bg-neutral-800 rounded">{typeof window !== 'undefined' ? window.location.host : 'server-render'}</code>
      </p>
      <a className="underline text-sky-400" href="/api/whoami">/api/whoami</a>
    </main>
  );
}
