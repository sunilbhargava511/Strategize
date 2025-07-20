export default function Header() {
  return (
    <header className="bg-primary-900 text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center space-x-3">
          <div className="text-3xl">📊</div>
          <h1 className="text-3xl font-bold tracking-tight">
            Stock Strategy Analysis Tool
          </h1>
        </div>
      </div>
    </header>
  )
}