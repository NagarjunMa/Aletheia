export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="h-10 w-10 rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</p>
      </div>
    </div>
  )
}
