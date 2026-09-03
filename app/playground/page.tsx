import { QuantumPlayground } from "@/components/ui/circuits/QuantumPlayground";
export default function PlaygroundPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground">
          Quantum Composer
        </h1>
        {/* We use a dummy userId for testing until you add authentication */}
        <QuantumPlayground 
          userId="test-user-id-123" 
          numWires={3} 
        />
      </div>
    </main>
  );
}