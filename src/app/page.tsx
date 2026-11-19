// Временная заглушка лендинга. Настоящий лендинг — задача A8.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
        Genesis Hackathon · ArtTech
      </p>
      <h1 className="text-5xl font-semibold leading-tight sm:text-6xl">Дневник атмосферы</h1>
      <p className="max-w-md text-lg text-muted">
        Расскажите, как прошёл день, приложите фото и песню — и сохраните не только то, как он
        выглядел, но и то, как он ощущался.
      </p>
      <p className="font-hand text-2xl -rotate-2">скоро здесь будет первый день…</p>
    </main>
  );
}
