import Link from "next/link";
import AuthNav from "../../components/AuthNav";
import { FileText, LayoutDashboard, MessageSquare, Settings } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-gray-50 p-6">
        <Link href="/" className="text-xl font-bold">
          DocuMind AI
        </Link>
        
        <nav className="mt-8 flex flex-col gap-2">
          <SidebarLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
            Dashboard
          </SidebarLink>
          <SidebarLink href="/documents" icon={<FileText className="h-4 w-4" />}>
            Documents
          </SidebarLink>
          <SidebarLink href="/chats" icon={<MessageSquare className="h-4 w-4" />}>
            Chats
          </SidebarLink>
          <SidebarLink href="/settings" icon={<Settings className="h-4 w-4" />}>
            Settings
          </SidebarLink>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end border-b bg-white px-8">
          <AuthNav />
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
    >
      {icon}
      {children}
    </Link>
  );
}