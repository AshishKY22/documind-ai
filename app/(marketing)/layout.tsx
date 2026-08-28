import Link from "next/link";
import AuthNav from "../../components/AuthNav";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            DocuMind AI
          </Link>
          
          <nav className="flex items-center gap-4">
            <AuthNav />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-gray-500">
        © 2026 DocuMind AI. Built with Next.js & Clerk.
      </footer>
    </div>
  );
}