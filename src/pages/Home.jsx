export default function Home() {
  const placeholders = Array.from({ length: 15 }).map((_, i) => ({ id: i + 1 }))

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to the Jewelry Store</h1>
      <p className="mb-6 text-gray-600">Showcase of jewelry items (placeholders)</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {placeholders.map((p) => (
          <div key={p.id} className="bg-white rounded shadow p-4 flex flex-col items-center">
            <div className="w-full h-40 bg-gray-200 rounded mb-3 flex items-center justify-center text-gray-400">Image {p.id}</div>
            <div className="text-sm font-medium">Product {p.id}</div>
            <div className="text-xs text-gray-500">$--.--</div>
          </div>
        ))}
      </div>
    </main>
  )
}
