"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const tick = setInterval(
      () => setProgress((p) => Math.min(96, p + Math.random() * 22)),
      180,
    );
    const go = setTimeout(() => router.push("/dashboard"), 1400);
    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden eih-gradient-deep">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-eih-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-eih-green-light/40 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center px-6 text-center fade-in">
        <div className="relative mb-8">
          <div className="absolute inset-0 -z-10 animate-ping rounded-full bg-eih-gold/25" />
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-white/5 p-3 ring-1 ring-eih-gold/40 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/eih.png"
              alt="EIH"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-eih-gold-light">
          EIH PMS
        </p>
        <h1 className="font-serif text-3xl text-white sm:text-4xl">
          Ethiopian Investment Holding
        </h1>
        <p className="mt-2 text-sm uppercase tracking-[0.22em] text-eih-on-green/80">
          Project Management System
        </p>

        <div className="mt-10 h-1 w-72 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full eih-gradient-gold transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-eih-on-green/60">
          Preparing your workspace…
        </p>
      </div>
    </div>
  );
}
