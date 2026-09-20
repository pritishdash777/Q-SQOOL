import Link from "next/link";
import XorLab from "@/components/learning/XorLab";

export default function QuantumXorPage() {
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8"><div className="mx-auto max-w-6xl"><Link className="text-sm text-primary" href="/learn">← Back to learning</Link><h1 className="mt-6 text-3xl font-bold sm:text-5xl">Quantum XOR, made tangible.</h1><p className="mt-4 max-w-2xl text-muted-foreground">A practical lab you can open straight from q-ai. Predict a result, run the circuit, and discover what makes a controlled quantum operation different.</p><XorLab /><Link className="text-primary underline" href="/composer">Build your own version in the full Composer →</Link></div></main>;
}
