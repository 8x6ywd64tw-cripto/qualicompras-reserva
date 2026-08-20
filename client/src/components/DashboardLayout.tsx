import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, FileText, ShoppingCart, Building2, Bell, TrendingUp, Truck, Shield, Package, BarChart3, Settings, History, Scale, ClipboardList, Target, GitCompare, Tag, Archive, CheckCircle2, XCircle, Wallet, Brain, FolderArchive, BellRing, ScanEye } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

type MenuSection = {
  title: string;
  items: { icon: typeof LayoutDashboard; label: string; path: string }[];
};

const menuSections: MenuSection[] = [
  {
    title: "PRINCIPAL",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: BellRing, label: "Notificações", path: "/notificacoes" },
      { icon: FileText, label: "Cotações Convencional", path: "/cotacoes" },
      { icon: ShoppingCart, label: "Pedidos", path: "/pedidos" },
      { icon: Users, label: "Fornecedores", path: "/fornecedores" },
      { icon: Building2, label: "Unidades", path: "/unidades" },
    ],
  },
  {
    title: "OPERACIONAL",
    items: [
      { icon: Package, label: "Cotações Fortes", path: "/requisicoes" },
      { icon: Brain, label: "Inteligência Compras", path: "/inteligencia-compras" },
      { icon: ScanEye, label: "Conferência NF (IA)", path: "/conferencia-nf" },
      { icon: History, label: "Histórico Preços", path: "/historico-precos" },
      { icon: GitCompare, label: "Comparativo Unidades", path: "/comparativo-unidades" },
      { icon: Tag, label: "Marcas", path: "/marcas" },
    ],
  },
  {
    title: "HISTÓRICO",
    items: [
      { icon: Archive, label: "Cotações Concluídas", path: "/historico-cotacoes" },
      { icon: CheckCircle2, label: "Pedidos Concluídos", path: "/historico-pedidos" },
     { icon: XCircle, label: "Cancelados", path: "/cancelados" },
      { icon: FolderArchive, label: "Histórico Solicitações Fortes", path: "/solicitacoes-fortes" },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { icon: Bell, label: "Alertas", path: "/alertas" },
      { icon: Shield, label: "Auditoria", path: "/auditoria" },
      { icon: ClipboardList, label: "Justificativas", path: "/justificativas" },
      { icon: Settings, label: "Configurações", path: "/configuracoes" },
    ],
  },
];

const allMenuItems = menuSections.flatMap(s => s.items);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
    } catch {}
  }, [sidebarWidth]);

  useEffect(() => {
    if (!loading && !user && typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }, [loading, user]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = allMenuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => { setIsResizing(false); };
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(4rem + env(safe-area-inset-top, 0px))' } as React.CSSProperties}>
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <img
                  src="/logo.png"
                  alt="Q"
                  className="h-7 w-7 rounded-md"
                />
              </button>
              {!isCollapsed ? (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold tracking-tight truncate text-sidebar-foreground text-base leading-tight">
                    QualiCompras
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/50 truncate leading-tight">
                    Central de Cotação Inteligente
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 sidebar-scroll">
            {menuSections.map((section) => {
              const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
              const isMaster = user?.email === MASTER_EMAIL;
              const userRole = user?.role;
              const filteredItems = section.items.filter(item => {
                // Configurações e Auditoria só aparecem para o ADM Master
                if (item.path === "/configuracoes") return isMaster;
                if (item.path === "/auditoria") return isMaster;
                if (item.path === "/justificativas") return isMaster;
                // Marcas: só Master e Júnior (buyer_senior)
                if (item.path === "/marcas") return isMaster || userRole === "buyer_senior";
                // Conferência NF: só Master e Júnior
                if (item.path === "/conferencia-nf") return isMaster || userRole === "buyer_senior";
                // Cotador: só vê Dashboard, Cotações Fortes, Cotações Convencional e páginas de leitura
                if (userRole === "cotador") {
                  const cotadorAllowed = ["/", "/requisicoes", "/cotacoes", "/pedidos", "/fornecedores", "/unidades", "/historico-precos", "/comparativo", "/historico-cotacoes", "/historico-pedidos", "/cancelados", "/comparativo-unidades"];
                  return cotadorAllowed.includes(item.path);
                }
                return true;
              });
              if (filteredItems.length === 0) return null;
              return (
                <div key={section.title} className="px-2 py-1">
                  {!isCollapsed && (
                    <p className="text-[10px] font-semibold tracking-widest text-sidebar-foreground/40 uppercase px-3 py-2">
                      {section.title}
                    </p>
                  )}
                  <SidebarMenu>
                    {filteredItems.map(item => {
                      const isActive = location === item.path;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            tooltip={item.label}
                            className="h-10 transition-all font-normal"
                          >
                            <item.icon
                              className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : ""}`}
                            />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-sidebar-primary text-sidebar-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate mt-1.5">
                      {user?.role === "admin" ? "Administrador" : user?.role === "aprovador" ? "Aprovador" : user?.role === "buyer_senior" ? "Comprador Sênior" : user?.role === "cotador" ? "Cotador" : "Comprador"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-sidebar-primary/20 transition-colors ${isCollapsed ? "hidden" : ""} md:block hidden`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
       {isMobile && (
          <div className="flex items-center justify-between bg-background px-3 sticky top-0 z-50 h-14" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' } as CSSProperties}>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="tracking-tight text-foreground font-semibold text-sm">
                {activeMenuItem?.label ?? "QualiCompras"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <img
                src="/logo.png"
                alt="QualiCompras"
                className="h-7 w-7 rounded-md"
              />
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}

function NotificationBell() {
  const [, navigate] = useLocation();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30000 });
  const { data: recentData } = trpc.notifications.list.useQuery({ limit: 8, offset: 0, unreadOnly: false }, { refetchInterval: 30000 });
  const utils = trpc.useUtils();
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => { utils.notifications.unreadCount.invalidate(); utils.notifications.list.invalidate(); },
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { utils.notifications.unreadCount.invalidate(); utils.notifications.list.invalidate(); },
  });

  const typeIcons: Record<string, string> = {
    supplier_response: "📩", quotation_ready: "✅", order_generated: "🛒",
    order_cancelled: "❌", quotation_reopened: "🔄", price_alert: "⚠️",
    delivery_adjusted: "✂️", no_response_48h: "⏰", doc_expired: "📄", system: "🔔",
  };

  const count = typeof unreadCount === 'number' ? unreadCount : 0;
  const recent = recentData?.items || [];

  // Auto-mark all as read when popover closes
  useEffect(() => {
    if (!popoverOpen && count > 0) {
      markAllReadMutation.mutate();
    }
  }, [popoverOpen]);

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors">
          <Bell className="h-5 w-5 text-foreground" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {count > 0 && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => markAllReadMutation.mutate()}
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {recent.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhuma notificação
            </div>
          ) : (
            recent.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-accent/50 transition-colors ${!n.readAt ? 'bg-primary/5' : ''}`}
                onClick={() => {
                  if (!n.readAt) markReadMutation.mutate({ id: n.id });
                  if (n.actionUrl) navigate(n.actionUrl);
                }}
              >
                <span className="text-lg mt-0.5 shrink-0">{typeIcons[n.type] || "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-tight ${!n.readAt ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleDateString("pt-BR")} {new Date(n.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!n.readAt && <span className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
              </div>
            ))
          )}
        </div>
        <div className="border-t px-4 py-2">
          <button
            className="text-xs text-primary hover:underline w-full text-center"
            onClick={() => navigate("/notificacoes")}
          >
            Ver todas as notificações
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
