"use client";
import UserButton from "./UserButton";
import Link from "next/link";
import Image from "next/image";

export default function Topbar() {
  return (
    <header className="h-14 w-full flex items-center justify-between px-4 md:px-6"
      style={{ backgroundColor: "var(--fm-bg)", color: "var(--fm-text)" }}>
      <Link href="/" className="flex items-center gap-3">
        <Image 
          src="/images/fminci-logo.png" 
          alt="FMinci Logo" 
          width={32} 
          height={32}
          className="rounded"
        />
        <span className="font-semibold tracking-wide text-white">FMinci</span>
      </Link>
      <UserButton />
    </header>
  );
}