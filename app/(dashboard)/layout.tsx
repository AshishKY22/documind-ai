import Link from "next/link";
import AuthNav from "../../components/AuthNav";
import { FileText, LayoutDashboard, MessageSquare, Settings } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar p-6">
        <Link href="/" className="text-xl font-bold text-sidebar-foreground">
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
        <header className="flex h-16 items-center justify-end border-b border-border bg-background px-8">
          <AuthNav />
        </header>
        <main className="flex-1 p-8 bg-background text-foreground">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}