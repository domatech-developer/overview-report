"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Users,
  Settings,
  FolderKanban,
  Search,
  Loader2,
  Save,
  Upload,
  Download,
  ChevronRight,
  ChevronDown,
  Share2,
  ArrowRight,
} from "lucide-react";

/**
 * Client Projects Dashboard — JSON-first, Mongo-ready
 * ---------------------------------------------------
 * Entities
 * - Client
 * - Subproject (belongsTo Client)
 * - Task (belongsTo Subproject)
 * - Event (Timeline/Agenda por Cliente/Subprojeto/Tarefa)
 */

// ------------------------- TYPES ------------------------- //
export type Status = "Pendente" | "Em andamento" | "Aguardando cliente" | "Concluída";
export type Priority = "Alta" | "Média" | "Baixa";
export type WorkType = "Site" | "App" | "SEO" | "Infra" | "Outros";
export type DemandOrigin = "Cliente" | "Interno" | "Outro projeto";
export type Area = "DEV" | "UX/UI" | "SEO" | "PROJETOS" | "GESTÃO";

export interface Task {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  // compat legado
  assignee?: string;
  // novo relacionamento
  assigneeId?: string;
  dueDate?: string; // ISO date
  workType: WorkType;
  origin: DemandOrigin;
  description?: string;
  startDate?: string; // ISO date
  relationId?: string; // link para outro subprojeto
  subprojectId: string;
}

export interface Subproject {
  id: string;
  name: string;
  clientId: string;
  status: "Ativo" | "Pausado" | "Concluído";
  startDate?: string; // ISO date
  endDate?: string; // ISO date (prazo)
}

export interface Client {
  id: string;
  name: string;
  contact?: string; // email/whatsapp
  channels?: string; // links
  priority?: "Alta" | "Média" | "Baixa";
  contract?: string; // SLA, horas/mês
  links?: string; // Figma/Drive/Site
  health?: "Saudável" | "Atenção" | "Crítico";
  lastTouch?: string; // último contato (auto)
  nextFollowUp?: string; // próxima cobrança
  risks?: string;
  monthHours?: string; // "previstas vs. consumidas"
  notes?: string; // observações estratégicas
  color?: string; // cor tema do cliente (hex)
}

export interface Collaborator {
  id: string;
  name: string;
  area: Area;
}

export type EventType =
  | "Reunião"
  | "Cobrança"
  | "Aprovação"
  | "Entrega"
  | "Decisão"
  | "Bloqueio"
  | "Atualização"
  | "Risco"
  | "Alinhamento interno"
  | "Contato sem retorno";

export interface EventItem {
  id: string;
  createdAt: string; // data/hora de registro
  when?: string; // quando aconteceu (opcional)
  type: EventType;
  summary: string; // frase curta p/ timeline
  details?: string;
  clientId: string;
  subprojectId?: string;
  taskId?: string;
  nextStep?: string; // o que fazer
  owner?: string; // responsável (legado)
  owners?: string[]; // responsáveis (ids de colaboradores)
  pendingFrom?: "Cliente" | "Equipe" | "Ambos" | "Nenhum";
  followUpAt?: string; // data do follow-up (Agenda usa)
  links?: string; // URLs
  isAlert?: boolean; // destaque visual
}

const DEFAULT_AREA: Area = "PROJETOS";

// -------------------- JSON DATA LAYER -------------------- //
const LS_KEY = "fp_dash_v1";

interface StoreShape {
  clients: Client[];
  subprojects: Subproject[];
  tasks: Task[];
  collaborators: Collaborator[];
  events: EventItem[]; // novo
}

const sampleData: StoreShape = {
  clients: [
    {
      id: "c1",
      name: "Teadit",
      color: "#2dd4bf",
      health: "Atenção",
      priority: "Alta",
      risks: "Dependência de credenciais da TI",
      lastTouch: new Date().toISOString(),
      notes: "Cobrar senha p/ testes de API",
    },
    { id: "c2", name: "Renato Cariani", color: "#60a5fa", health: "Saudável", priority: "Média", notes: "Estratégia: YouTube Members + área logada" },
    { id: "c3", name: "Ligga", color: "#fbbf24", health: "Atenção", priority: "Alta", notes: "LP Play no ar; pendências de conteúdo" },
    { id: "c4", name: "Condor", color: "#a78bfa", health: "Atenção", priority: "Média", notes: "Múltiplas LPs; definir prioridade" },
    { id: "c5", name: "Skydiet", color: "#34d399", health: "Saudável", priority: "Alta", notes: "Módulo QPC entregue; plano alimentar em andamento" },
  ],
  subprojects: [
    { id: "s1", name: "API Articles", clientId: "c1", status: "Ativo" },
    { id: "s2", name: "Área Logada + Members", clientId: "c2", status: "Ativo" },
    { id: "s3", name: "Ligga Play", clientId: "c3", status: "Ativo" },
    { id: "s4", name: "LP Aniversário", clientId: "c4", status: "Ativo" },
    { id: "s5", name: "QPC & Plano Alimentar", clientId: "c5", status: "Ativo" },
  ],
  tasks: [
    {
      id: "t1",
      title: "Testar API (credenciais)",
      status: "Em andamento",
      priority: "Alta",
      assignee: "João",
      dueDate: addDays(3),
      workType: "Site",
      origin: "Cliente",
      description: "Cobrar senha com Rodrigo (TI)",
      subprojectId: "s1",
    },
    {
      id: "t2",
      title: "Definir UX da área logada",
      status: "Pendente",
      priority: "Média",
      assignee: "Vitor",
      workType: "Site",
      origin: "Interno",
      subprojectId: "s2",
    },
    {
      id: "t3",
      title: "Ajustes de layout LP Play",
      status: "Aguardando cliente",
      priority: "Média",
      assignee: "Kevin",
      workType: "Site",
      origin: "Cliente",
      subprojectId: "s3",
    },
    {
      id: "t4",
      title: "Conteúdo de downloads (KV)",
      status: "Em andamento",
      priority: "Baixa",
      assignee: "Vitor",
      workType: "Site",
      origin: "Cliente",
      subprojectId: "s4",
    },
    {
      id: "t5",
      title: "Entregar QPC – fluxo paciente",
      status: "Pendente",
      priority: "Alta",
      assignee: "Felipe",
      dueDate: addDays(5),
      workType: "App",
      origin: "Interno",
      subprojectId: "s5",
    },
  ],
  collaborators: [
    { id: "u1", name: "Kevin", area: "UX/UI" },
    { id: "u2", name: "Vitor", area: "UX/UI" },
    { id: "u3", name: "Mari", area: "SEO" },
    { id: "u4", name: "João", area: "DEV" },
    { id: "u5", name: "Eduardo", area: "DEV" },
    { id: "u6", name: "Felipe", area: "GESTÃO" },
    { id: "u7", name: "Nicole", area: "PROJETOS" },
  ],
  events: [], // histórico vazio ao iniciar
};

function addDays(d: number) {
  return new Date(Date.now() + d * 86400000).toISOString();
}

// Helper function to get current date/time in São Paulo timezone
function getCurrentDateTimeSP(): string {
  const now = new Date();
  // Create a date object representing the current time in São Paulo
  // by using the timezone offset approach
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const spTime = new Date(utc + 3 * 60 * 60 * 1000); // UTC-3 for São Paulo
  return spTime.toISOString();
}

function migrateData(input: Partial<StoreShape>): StoreShape {
  const clients = input.clients ?? sampleData.clients;
  const subprojects = input.subprojects ?? sampleData.subprojects;
  const tasksRaw = input.tasks ?? sampleData.tasks;
  const collaborators: Collaborator[] = [...(input.collaborators ?? sampleData.collaborators ?? [])];

  const nameKey = (s: string) => s.trim().toLowerCase();
  const collabByName = new Map<string, Collaborator>(collaborators.map((c) => [nameKey(c.name), c]));

  const tasks: Task[] = tasksRaw.map((t) => {
    if (t.assigneeId) return t;
    const name = (t.assignee ?? "").trim();
    if (!name) return t;
    const key = nameKey(name);
    let col = collabByName.get(key);
    if (!col) {
      col = { id: uid("u"), name, area: DEFAULT_AREA };
      collaborators.push(col);
      collabByName.set(key, col);
    }
    return { ...t, assigneeId: col.id };
  });

  const events: EventItem[] = (input as any).events ?? [];

  return { clients, subprojects, tasks, collaborators, events };
}

const jsonStore = {
  load(): StoreShape {
    if (typeof window === "undefined") return sampleData;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return migrateData(sampleData);
    try {
      const parsed = JSON.parse(raw) as Partial<StoreShape>;
      return migrateData(parsed);
    } catch {
      return sampleData;
    }
  },
  save(data: StoreShape) {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  },
  export(data: StoreShape) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `felipe_projects_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ------------------------- UI HELPERS ------------------------- //
const Badge: React.FC<{ color?: string; children: React.ReactNode }> = ({ color = "bg-zinc-800", children }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${color}`}>{children}</span>
);

const Card: React.FC<{ title?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }> = ({ title, right, children }) => (
  <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/50 shadow-sm">
    {title && (
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }> = ({ title, onClose, children, footer }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60" onClick={onClose} />
    <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950 shadow-xl">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <button onClick={onClose} className="rounded-lg border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900">
          Fechar
        </button>
      </div>
      <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
      {footer && <div className="border-t border-zinc-800/60 bg-zinc-950 px-4 py-3">{footer}</div>}
    </div>
  </div>
);

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// helper de eventos
function addEvent(d: StoreShape, e: Omit<EventItem, "id" | "createdAt">): StoreShape {
  const ev: EventItem = { id: uid("e"), createdAt: getCurrentDateTimeSP(), ...e };
  return { ...d, events: [ev, ...d.events] };
}

// ---------------------- REMOTE API (JSON Server) ---------------------- //
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

async function apiList<T>(path: string): Promise<T[]> {
  const res = await fetch(`${API_BASE}/${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}
async function apiCreate<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${path} failed`);
  return res.json();
}
async function apiUpdate<T>(path: string, id: string | number, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PUT ${path}/${id} failed`);
  return res.json();
}
async function apiDelete(path: string, id: string | number): Promise<void> {
  const res = await fetch(`${API_BASE}/${path}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path}/${id} failed`);
}

async function loadRemoteData(): Promise<StoreShape> {
  const [clients, subprojects, tasks, collaborators, events] = await Promise.all([
    apiList<Client>("clients"),
    apiList<Subproject>("subprojects"),
    apiList<Task>("tasks"),
    apiList<Collaborator>("collaborators"),
    apiList<EventItem>("events"),
  ]);
  return migrateData({ clients, subprojects, tasks, collaborators, events });
}

async function createEventRemote(e: Omit<EventItem, "id" | "createdAt">): Promise<EventItem> {
  const ev: EventItem = { id: uid("e"), createdAt: getCurrentDateTimeSP(), ...e };
  await apiCreate<EventItem>("events", ev);
  return ev;
}

// ------------------------- MAIN APP ------------------------- //
export default function Page() {
  const [data, setData] = useState<StoreShape>(sampleData);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "clients" | "collaborators" | "timeline" | "flow" | "capacity">("overview");
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  type TabId = "overview" | "clients" | "timeline" | "capacity" | "flow" | "collaborators";
  const DEFAULT_TABS_ORDER: TabId[] = ["overview", "clients", "timeline", "capacity", "flow", "collaborators"];
  const TAB_LABEL: Record<TabId, string> = {
    overview: "Overview",
    clients: "Clientes",
    timeline: "Timeline",
    capacity: "Capacidade",
    flow: "Flow",
    collaborators: "Colaboradores",
  };
  function TabIcon({ id }: { id: TabId }) {
    const cls = "h-4 w-4";
    switch (id) {
      case "overview":
        return <FolderKanban className={cls} />;
      case "clients":
        return <Users className={cls} />;
      case "timeline":
        return <Calendar className={cls} />;
      case "capacity":
        return <Users className={cls} />;
      case "flow":
        return <Share2 className={cls} />;
      case "collaborators":
        return <Users className={cls} />;
      default:
        return null;
    }
  }
  const TABS_LS_KEY = "fp_dash_tabs_v1";
  const [tabsOrder, setTabsOrder] = useState<TabId[]>(DEFAULT_TABS_ORDER);
  const [isReorderTabsOpen, setIsReorderTabsOpen] = useState(false);
  const [tabOrderDraft, setTabOrderDraft] = useState<TabId[] | null>(null);
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [activeClientFilter, setActiveClientFilter] = useState<string | "all">("all");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientDraft, setClientDraft] = useState<Client | null>(null);
  const [creatingClient, setCreatingClient] = useState<boolean>(false);
  const [newClientDraft, setNewClientDraft] = useState<Client | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<Task | null>(null);
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false);
  const [taskCreateDraft, setTaskCreateDraft] = useState<Task | null>(null);
  const [timelineClientId, setTimelineClientId] = useState<string | "all">("all");
  const [timelineSubprojectId, setTimelineSubprojectId] = useState<string | null>(null);
  // Subproject accordions (Clients tab)
  const [subExpanded, setSubExpanded] = useState<Record<string, boolean>>({});
  const [expandAllSubprojects, setExpandAllSubprojects] = useState<boolean>(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState<{
    clientId: string;
    subprojectId?: string;
    type: EventType;
    followUpAt: string; // ISO
    details?: string;
    pendingFrom: "Cliente" | "Equipe" | "Ambos" | "Nenhum";
    owners: string[];
    isAlert: boolean;
  } | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<{
    clientId: string;
    subprojectId?: string;
    type: EventType;
    summary: string;
    when: string; // ISO
    details?: string;
    nextStep?: string;
    owners: string[];
    links?: string;
    followUpAt?: string;
  } | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  // Flow: track which scroll containers were auto-scrolled
  const flowInitScrolled = useRef<WeakSet<HTMLDivElement> | null>(null);
  if (!flowInitScrolled.current) flowInitScrolled.current = new WeakSet();

  // -------- Clients tab filters/sorting --------
  const [clientsFilterClientId, setClientsFilterClientId] = useState<string | "all">("all");
  const [clientsFilterHealth, setClientsFilterHealth] = useState<Client["health"] | "all">("all");
  const [clientsFilterPriority, setClientsFilterPriority] = useState<Client["priority"] | "all">("all");

  const priorityOrder: Record<NonNullable<Client["priority"]>, number> = { Alta: 0, Média: 1, Baixa: 2 };

  function getClientLastUpdateIso(c: Client): string | undefined {
    // Considera lastTouch do cliente e eventos relacionados
    const times: string[] = [];
    if (c.lastTouch) times.push(c.lastTouch);
    for (const e of data.events) {
      if (e.clientId !== c.id) continue;
      if (e.createdAt) times.push(e.createdAt);
      if (e.when) times.push(e.when);
      if (e.followUpAt) times.push(e.followUpAt);
    }
    if (times.length === 0) return undefined;
    return times.sort((a, b) => b.localeCompare(a))[0];
  }

  const clientsList = useMemo(() => {
    let list = [...data.clients];
    if (clientsFilterClientId !== "all") list = list.filter((c) => c.id === clientsFilterClientId);
    if (clientsFilterHealth !== "all") list = list.filter((c) => (c.health || "Saudável") === clientsFilterHealth);
    if (clientsFilterPriority !== "all") list = list.filter((c) => (c.priority || "Média") === clientsFilterPriority);

    // Sort: last update desc, then priority (Alta -> Baixa), then name
    return list
      .map((c) => ({ c, lastUpdate: getClientLastUpdateIso(c) }))
      .sort((a, b) => {
        const la = a.lastUpdate;
        const lb = b.lastUpdate;
        if (la && lb) {
          const cmp = lb.localeCompare(la);
          if (cmp !== 0) return cmp;
        } else if (la || lb) {
          return lb ? 1 : -1; // quem tem atualização recente vai primeiro
        }
        const pa = priorityOrder[(a.c.priority || "Média") as NonNullable<Client["priority"]>];
        const pb = priorityOrder[(b.c.priority || "Média") as NonNullable<Client["priority"]>];
        if (pa !== pb) return pa - pb;
        return a.c.name.localeCompare(b.c.name);
      })
      .map((x) => x.c);
  }, [data.clients, data.events, clientsFilterClientId, clientsFilterHealth, clientsFilterPriority]);

  // Load from localStorage
  useEffect(() => {
    (async () => {
      try {
        const d = await loadRemoteData();
        setData(d);
        setRemoteReady(true);
      } catch (err: any) {
        setRemoteError("Falha ao carregar API remota; usando dados locais.");
        setData(jsonStore.load());
      } finally {
        setLoading(false);
      }
    })();
    // load tabs order
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(TABS_LS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as TabId[];
        if (Array.isArray(parsed) && parsed.length) setTabsOrder(parsed as TabId[]);
      }
    } catch {}
  }, []);

  // Persist on change (local fallback only)
  useEffect(() => {
    if (!loading && !remoteReady) jsonStore.save(data);
  }, [data, loading, remoteReady]);

  // Persist tabs order
  useEffect(() => {
    try {
      if (typeof window !== "undefined") localStorage.setItem(TABS_LS_KEY, JSON.stringify(tabsOrder));
    } catch {}
  }, [tabsOrder]);

  const tasksFiltered = useMemo(() => {
    const byDone = data.tasks.filter((t) => (showDone ? true : t.status !== "Concluída"));
    const byClient =
      activeClientFilter === "all"
        ? byDone
        : byDone.filter((t) => {
            const sp = data.subprojects.find((s) => s.id === t.subprojectId);
            return sp?.clientId === activeClientFilter;
          });
    const byQuery = query.trim() ? byClient.filter((t) => t.title.toLowerCase().includes(query.toLowerCase())) : byClient;
    return byQuery;
  }, [data, showDone, activeClientFilter, query]);

  const clientsMap = useMemo(() => Object.fromEntries(data.clients.map((c) => [c.id, c])), [data.clients]);
  const subMap = useMemo(() => Object.fromEntries(data.subprojects.map((s) => [s.id, s])), [data.subprojects]);
  const collaboratorsMap = useMemo(() => Object.fromEntries((data.collaborators ?? []).map((u) => [u.id, u])), [data.collaborators]);

  // Group tasks by status for Kanban
  const columns: Status[] = ["Pendente", "Em andamento", "Aguardando cliente", "Concluída"];
  const grouped: Record<Status, Task[]> = useMemo(() => {
    return columns.reduce((acc, st) => {
      acc[st] = tasksFiltered.filter((t) => t.status === st);
      return acc;
    }, {} as Record<Status, Task[]>);
  }, [tasksFiltered]);

  function addClient() {
    setNewClientDraft({
      id: uid("c"),
      name: "",
      contact: "",
      channels: "",
      priority: "Média",
      contract: "",
      links: "",
      health: "Saudável",
      lastTouch: undefined,
      nextFollowUp: undefined,
      risks: "",
      monthHours: "",
      notes: "",
    });
    setCreatingClient(true);
  }

  const [creatingSubproject, setCreatingSubproject] = useState<{
    clientId: string | null;
    draft: Subproject | null;
  }>({ clientId: null, draft: null });

  function addSubproject(clientId: string) {
    setCreatingSubproject({
      clientId,
      draft: { id: uid("s"), name: "", clientId, status: "Ativo" },
    });
  }

  // =================== TAREFAS (c/ eventos automáticos) ===================

  function openCreateTask(subprojectId: string) {
    const draft: Task = {
      id: uid("t"),
      title: "",
      status: "Pendente",
      priority: "Média",
      workType: "Outros",
      origin: "Interno",
      subprojectId,
      relationId: subprojectId,
    } as Task;
    setTaskCreateDraft(draft);
    setIsTaskCreateOpen(true);
  }

  async function saveCreateTask() {
    if (!taskCreateDraft) return;
    if (!taskCreateDraft.title.trim()) return alert("Informe o título da tarefa");
    const toSave: Task = { ...taskCreateDraft, relationId: taskCreateDraft.subprojectId };
    const sp = data.subprojects.find((s) => s.id === toSave.subprojectId);
    const clientId = sp?.clientId!;
    if (remoteReady) {
      const created = await apiCreate<Task>("tasks", toSave);
      const ev = await createEventRemote({
        type: "Atualização",
        summary: `Tarefa criada: ${toSave.title}`,
        clientId,
        subprojectId: toSave.subprojectId,
        taskId: toSave.id,
      });
      setData((d) => ({ ...d, tasks: [created, ...d.tasks], events: [ev, ...d.events] }));
    } else {
      setData((d) => {
        const nd = { ...d, tasks: [toSave, ...d.tasks] };
        return addEvent(nd, {
          type: "Atualização",
          summary: `Tarefa criada: ${toSave.title}`,
          clientId,
          subprojectId: toSave.subprojectId,
          taskId: toSave.id,
        });
      });
    }
    setIsTaskCreateOpen(false);
    setTaskCreateDraft(null);
  }

  async function updateTask(upd: Partial<Task> & { id: string }) {
    const prev = data.tasks.find((t) => t.id === upd.id);
    if (!prev) return;
    const next = { ...prev, ...upd } as Task;
    if (remoteReady) {
      await apiUpdate<Task>("tasks", next.id, next);
      const sp = data.subprojects.find((s) => s.id === prev.subprojectId);
      const clientId = sp?.clientId!;
      const eventsToAdd: Array<Omit<EventItem, "id" | "createdAt">> = [];
      if (upd.status && prev.status !== upd.status) {
        eventsToAdd.push({
          type: upd.status === "Concluída" ? "Entrega" : "Atualização",
          summary: `Status: ${prev.status} → ${upd.status} (${prev.title})`,
          clientId,
          subprojectId: prev.subprojectId,
          taskId: prev.id,
        });
      }
      if (upd.dueDate && prev.dueDate !== upd.dueDate) {
        eventsToAdd.push({
          type: "Decisão",
          summary: `Prazo atualizado para ${new Date(upd.dueDate).toLocaleDateString("pt-BR")} (${prev.title})`,
          clientId,
          subprojectId: prev.subprojectId,
          taskId: prev.id,
          followUpAt: upd.dueDate,
        });
      }
      const createdEvents: EventItem[] = [];
      for (const e of eventsToAdd) createdEvents.push(await createEventRemote(e));
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === next.id ? next : t)), events: [...createdEvents, ...d.events] }));
    } else {
      setData((d) => {
        const nextTasks = d.tasks.map((t) => (t.id === next.id ? next : t));
        let nd: StoreShape = { ...d, tasks: nextTasks };
        const sp = d.subprojects.find((s) => s.id === prev.subprojectId);
        const clientId = sp?.clientId!;
        if (upd.status && prev.status !== upd.status) {
          nd = addEvent(nd, {
            type: upd.status === "Concluída" ? "Entrega" : "Atualização",
            summary: `Status: ${prev.status} → ${upd.status} (${prev.title})`,
            clientId,
            subprojectId: prev.subprojectId,
            taskId: prev.id,
          });
        }
        if (upd.dueDate && prev.dueDate !== upd.dueDate) {
          nd = addEvent(nd, {
            type: "Decisão",
            summary: `Prazo atualizado para ${new Date(upd.dueDate).toLocaleDateString("pt-BR")} (${prev.title})`,
            clientId,
            subprojectId: prev.subprojectId,
            taskId: prev.id,
            followUpAt: upd.dueDate,
          });
        }
        return nd;
      });
    }
  }

  async function deleteTask(id: string) {
    if (remoteReady) await apiDelete("tasks", id);
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }

  // =================== IMPORT/EXPORT ===================

  async function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const nextRaw = JSON.parse(String(reader.result)) as Partial<StoreShape>;
        const next = migrateData(nextRaw);
        if (remoteReady) {
          // naive replace: clear and re-insert
          const toClear = ["clients", "subprojects", "tasks", "collaborators", "events"] as const;
          for (const key of toClear) {
            const list = await apiList<any>(key);
            for (const item of list) await apiDelete(key, item.id);
          }
          for (const c of next.clients) await apiCreate("clients", c);
          for (const s of next.subprojects) await apiCreate("subprojects", s);
          for (const t of next.tasks) await apiCreate("tasks", t);
          for (const u of next.collaborators) await apiCreate("collaborators", u);
          for (const ev of next.events) await apiCreate("events", ev);
          const fresh = await loadRemoteData();
          setData(fresh);
        } else {
          setData(next);
          jsonStore.save(next);
        }
        alert("Dados importados com sucesso.");
      } catch {
        alert("JSON inválido");
      }
    };
    reader.readAsText(file);
  }

  // =================== COLABORADORES ===================

  const AREAS: Area[] = ["DEV", "UX/UI", "SEO", "PROJETOS", "GESTÃO"];

  async function addCollaborator() {
    const name = prompt("Nome do colaborador");
    if (!name) return;
    const area = prompt(`Área do colaborador (opções: ${AREAS.join(", ")})`, "PROJETOS") as Area | null;
    if (!area || !AREAS.includes(area)) return alert("Área inválida");
    const col = { id: uid("u"), name, area } as Collaborator;
    if (remoteReady) await apiCreate<Collaborator>("collaborators", col);
    setData((d) => ({ ...d, collaborators: [...(d.collaborators ?? []), col] }));
  }

  async function updateCollaborator(upd: Partial<Collaborator> & { id: string }) {
    if (remoteReady) {
      const prev = data.collaborators.find((u) => u.id === upd.id);
      if (prev) await apiUpdate<Collaborator>("collaborators", upd.id, { ...prev, ...upd });
    }
    setData((d) => ({ ...d, collaborators: (d.collaborators ?? []).map((u) => (u.id === upd.id ? { ...u, ...upd } : u)) }));
  }

  async function deleteCollaborator(id: string) {
    if (!confirm("Excluir colaborador? Tarefas que apontarem para ele continuarão com o vínculo (pode ficar vazio).")) return;
    if (remoteReady) await apiDelete("collaborators", id);
    setData((d) => ({ ...d, collaborators: (d.collaborators ?? []).filter((u) => u.id !== id) }));
  }

  // =================== CLIENTES (edit) ===================

  function openEditClient(clientId: string) {
    const c = data.clients.find((x) => x.id === clientId);
    if (!c) return;
    setEditingClientId(clientId);
    setClientDraft({ ...c });
  }

  function updateClientDraft<K extends keyof Client>(key: K, value: Client[K]) {
    setClientDraft((curr) => (curr ? { ...curr, [key]: value } : curr));
  }

  async function saveClientEdit() {
    if (!editingClientId || !clientDraft) return;
    const toSave: Client = { ...clientDraft, lastTouch: new Date().toISOString() };
    if (remoteReady) await apiUpdate<Client>("clients", editingClientId, toSave);
    setData((d) => ({ ...d, clients: d.clients.map((c) => (c.id === editingClientId ? toSave : c)) }));
    setEditingClientId(null);
    setClientDraft(null);
  }

  // =================== TASK EDIT (modal) ===================

  function openEditTask(taskId: string) {
    const t = data.tasks.find((x) => x.id === taskId);
    if (!t) return;
    setEditingTaskId(taskId);
    setTaskDraft({ ...t });
  }

  function updateTaskDraft<K extends keyof Task>(key: K, value: Task[K]) {
    setTaskDraft((curr) => (curr ? { ...curr, [key]: value } : curr));
  }

  async function saveTaskEdit() {
    if (!editingTaskId || !taskDraft) return;
    const toSave: Task = { ...taskDraft };
    if (remoteReady) await apiUpdate<Task>("tasks", toSave.id, toSave);
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === editingTaskId ? toSave : t)) }));
    setEditingTaskId(null);
    setTaskDraft(null);
  }

  // =================== EVENTO MANUAL (atalho simples) ===================

  async function addManualEventForClient(clientId: string, subprojectId?: string) {
    const type = (prompt(
      "Tipo (ex.: Reunião, Cobrança, Aprovação, Entrega, Decisão, Bloqueio, Atualização, Risco, Alinhamento interno, Contato sem retorno)",
      "Atualização"
    ) || "") as EventType;
    if (!type) return;
    const summary = prompt("Resumo do evento (ex.: Reunião com TI, cobrança enviada)");
    if (!summary) return;
    const follow = prompt("Próximo passo (opcional)");
    const owner = prompt("Responsável (opcional)");
    const at = prompt("Data do follow-up (AAAA-MM-DD) (opcional)");
    if (remoteReady) {
      const ev = await createEventRemote({
        type,
        summary,
        clientId,
        subprojectId,
        nextStep: follow || undefined,
        owner: owner || undefined,
        followUpAt: at ? new Date(at).toISOString() : undefined,
      });
      setData((d) => ({ ...d, events: [ev, ...d.events] }));
    } else {
      setData((d) =>
        addEvent(d, {
          type,
          summary,
          clientId,
          subprojectId,
          nextStep: follow || undefined,
          owner: owner || undefined,
          followUpAt: at ? new Date(at).toISOString() : undefined,
        })
      );
    }
  }

  function openEventModal(clientId: string, subprojectId?: string) {
    const nowIso = getCurrentDateTimeSP();
    setEventDraft({
      clientId,
      subprojectId,
      type: "Atualização",
      summary: "",
      when: nowIso,
      details: "",
      nextStep: "",
      owners: [],
      links: "",
      followUpAt: undefined,
    });
    setIsEventModalOpen(true);
  }

  async function saveEvent() {
    if (!eventDraft) return;
    const { clientId, subprojectId, type, summary, when, details, nextStep, owners, links, followUpAt } = eventDraft;
    if (!summary.trim()) return alert("Informe o resumo do evento");
    if (remoteReady) {
      if (editingEventId) {
        const prev = data.events.find((e) => e.id === editingEventId);
        if (prev) {
          const updated: EventItem = {
            ...prev,
            type,
            summary: summary.trim(),
            details: details || undefined,
            clientId,
            subprojectId,
            when,
            nextStep: nextStep || undefined,
            owners: owners.length ? owners : undefined,
            links: links || undefined,
            followUpAt: followUpAt || undefined,
          };
          await apiUpdate<EventItem>("events", editingEventId, updated);
          setData((d) => ({ ...d, events: d.events.map((ev) => (ev.id === editingEventId ? updated : ev)) }));
        }
      } else {
        const ev = await createEventRemote({
          type,
          summary: summary.trim(),
          details: details || undefined,
          clientId,
          subprojectId,
          when,
          nextStep: nextStep || undefined,
          owners: owners.length ? owners : undefined,
          links: links || undefined,
          followUpAt: followUpAt || undefined,
        });
        setData((d) => ({ ...d, events: [ev, ...d.events] }));
      }
    } else {
      setData((d) => {
        if (editingEventId) {
          return {
            ...d,
            events: d.events.map((ev) =>
              ev.id === editingEventId
                ? {
                    ...ev,
                    type,
                    summary: summary.trim(),
                    details: details || undefined,
                    clientId,
                    subprojectId,
                    when,
                    nextStep: nextStep || undefined,
                    owners: owners.length ? owners : undefined,
                    links: links || undefined,
                    followUpAt: followUpAt || undefined,
                  }
                : ev
            ),
          };
        }
        return addEvent(d, {
          type,
          summary: summary.trim(),
          details: details || undefined,
          clientId,
          subprojectId,
          when,
          nextStep: nextStep || undefined,
          owners: owners.length ? owners : undefined,
          links: links || undefined,
          followUpAt: followUpAt || undefined,
        });
      });
    }
    setIsEventModalOpen(false);
    setEventDraft(null);
    setEditingEventId(null);
  }

  function openFollowUpModal(clientId: string, subprojectId?: string) {
    const nowIso = getCurrentDateTimeSP();
    setFollowUpDraft({
      clientId,
      subprojectId,
      type: "Atualização",
      followUpAt: nowIso,
      details: "",
      pendingFrom: "Nenhum",
      owners: [],
      isAlert: false,
    });
    setIsFollowUpModalOpen(true);
  }

  async function saveFollowUp() {
    if (!followUpDraft) return;
    const { clientId, subprojectId, type, followUpAt, details, pendingFrom, owners, isAlert } = followUpDraft;
    const base = (details || "").trim();
    const autoSummary = base ? (base.split(/\n|\.\s/)[0] || base).slice(0, 100) : "Follow-up registrado";
    if (remoteReady) {
      const ev = await createEventRemote({
        type,
        summary: autoSummary,
        details: details || undefined,
        clientId,
        subprojectId,
        followUpAt,
        pendingFrom,
        owners: owners.length ? owners : undefined,
        isAlert,
      });
      setData((d) => ({ ...d, events: [ev, ...d.events] }));
    } else {
      setData((d) =>
        addEvent(d, {
          type,
          summary: autoSummary,
          details: details || undefined,
          clientId,
          subprojectId,
          followUpAt,
          pendingFrom,
          owners: owners.length ? owners : undefined,
          isAlert,
        })
      );
    }
    setIsFollowUpModalOpen(false);
    setFollowUpDraft(null);
  }

  async function deleteEvent(eventId: string) {
    if (remoteReady) await apiDelete("events", eventId);
    setData((d) => ({ ...d, events: d.events.filter((e) => e.id !== eventId) }));
  }

  // =================== UI ===================

  const router = useRouter();

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center text-zinc-300">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando dashboard…
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl p-6 text-zinc-100">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overview Report - Domatech</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST" });
                router.replace("/login");
              } catch {}
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/60 px-3 py-2 text-sm hover:bg-zinc-900"
          >
            Sair
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-800/60 px-3 py-2 text-sm hover:bg-zinc-900">
            <Upload className="h-4 w-4" />
            Importar JSON
            <input onChange={importJSON} type="file" accept="application/json" className="hidden" />
          </label>
          <button
            onClick={async () => {
              const snapshot = remoteReady ? await loadRemoteData() : data;
              jsonStore.export(snapshot);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/60 px-3 py-2 text-sm hover:bg-zinc-900"
          >
            <Download className="h-4 w-4" /> Exportar JSON
          </button>
          <button
            onClick={addClient}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            <Plus className="h-4 w-4" /> Novo cliente
          </button>
        </div>
      </header>

      {/* Top: Agenda only (50% width) */}
      <div className="mb-6">
        <div className="w-full md:w-1/2">
          <Card title="Agenda" right={<Calendar className="h-4 w-4 text-zinc-400" />}>
            {(() => {
              const getUpdateIso = (ev: EventItem) => {
                const times = [ev.createdAt];
                if (ev.when) times.push(ev.when);
                if (ev.followUpAt) times.push(ev.followUpAt);
                return times.sort((a, b) => b.localeCompare(a))[0];
              };
              const latest = [...data.events].sort((a, b) => getUpdateIso(b).localeCompare(getUpdateIso(a))).slice(0, 8);
              if (latest.length === 0) return <div className="text-sm text-zinc-400">Sem eventos recentes.</div>;
              return (
                <div className="space-y-2 max-h-[20vh] overflow-auto pr-1">
                  {latest.map((e) => {
                    const client = data.clients.find((c) => c.id === e.clientId);
                    const sub = e.subprojectId ? data.subprojects.find((s) => s.id === e.subprojectId) : undefined;
                    const whenStr = new Date(getUpdateIso(e)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
                    return (
                      <div key={e.id} className="rounded-lg border border-zinc-800/60 bg-zinc-950 p-2 text-xs">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: client?.color || "#64748b" }} />
                            <div className="truncate text-zinc-400">
                              <span className="font-medium text-zinc-300">{client?.name || "—"}</span>
                              {sub && <span> • {sub.name}</span>}
                              <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">{e.type}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-zinc-500">{whenStr}</div>
                        </div>
                        <div className="truncate font-medium text-zinc-100">{e.summary}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-2">
        {tabsOrder.map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm cursor-pointer",
              tab === id ? "bg-zinc-100 text-zinc-900" : "border border-zinc-800/60 text-zinc-200 hover:bg-zinc-900"
            )}
          >
            <TabIcon id={id} /> {TAB_LABEL[id]}
          </button>
        ))}
        <button
          onClick={() => {
            setTabOrderDraft(tabsOrder);
            setIsReorderTabsOpen(true);
          }}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-zinc-800/60 px-3 py-2 text-sm hover:bg-zinc-900"
        >
          <Settings className="h-4 w-4" /> tabs
        </button>
      </div>

      {tab === "overview" && (
        <>
          <div className="mb-4">
            <Card title="Filtros" right={<Badge color="bg-indigo-600">{tasksFiltered.length} tarefas</Badge>}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar tarefa…"
                    className="w-56 rounded-lg border border-zinc-800 bg-zinc-950 px-7 py-2 text-sm outline-none placeholder:text-zinc-600"
                  />
                </div>
                <select
                  value={activeClientFilter}
                  onChange={(e) => setActiveClientFilter(e.target.value as any)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="all">Todos os clientes</option>
                  {data.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showDone} onChange={() => setShowDone((v) => !v)} />
                  Mostrar concluídas
                </label>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {columns.map((col) => (
              <motion.div
                key={col}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40"
              >
                <div className="flex items-center justify-between border-b border-zinc-800/60 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {col === "Concluída" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <ListChecks className="h-4 w-4 text-zinc-400" />}
                    {col}
                  </div>
                  <Badge color={col === "Concluída" ? "bg-emerald-600" : "bg-zinc-700"}>{grouped[col].length}</Badge>
                </div>
                <div className="space-y-3 p-3">
                  {grouped[col].map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-zinc-800/60 p-3"
                      style={{
                        backgroundColor: `${data.clients.find((c) => c.id === subMap[t.subprojectId]?.clientId)?.color || "#64748b"}1A`,
                      }}
                    >
                      <div className="mb-2 inline-flex items-center gap-2">
                        <div className="text-sm font-medium text-zinc-100">{t.title}</div>
                        <div className="flex items-center gap-1">
                          {t.priority === "Alta" && <Badge color="bg-red-600">Alta</Badge>}
                          {t.priority === "Média" && <Badge color="bg-amber-600">Média</Badge>}
                          {t.priority === "Baixa" && <Badge color="bg-zinc-600">Baixa</Badge>}
                        </div>
                      </div>
                      <div className="mb-2 text-xs text-zinc-400">
                        <span className="mr-2">
                          {clientsMap[subMap[t.subprojectId]?.clientId!]?.name} • {subMap[t.subprojectId]?.name}
                        </span>
                        {(t.assigneeId || t.assignee) && <span className="mr-2">| {(t.assigneeId && collaboratorsMap[t.assigneeId]?.name) || t.assignee}</span>}
                        {t.dueDate && <span>| Prazo: {new Date(t.dueDate).toLocaleDateString("pt-BR")}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 gap-y-2">
                        <select
                          value={t.status}
                          onChange={(e) => updateTask({ id: t.id, status: e.target.value as Status })}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/60 backdrop-blur px-2 py-1 text-xs shrink-0"
                        >
                          {columns.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => updateTask({ id: t.id, status: "Concluída" })}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/60 backdrop-blur px-2 py-1 text-xs hover:bg-zinc-900 shrink-0"
                        >
                          Concluir
                        </button>
                        <button
                          onClick={() => openEditTask(t.id)}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/60 backdrop-blur px-2 py-1 text-xs hover:bg-zinc-900 shrink-0"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteTask(t.id)}
                          className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-950 shrink-0"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                  {grouped[col].length === 0 && <div className="p-3 text-center text-xs text-zinc-500">Sem tarefas</div>}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {tab === "clients" && (
        <div>
          {/* Filters */}
          <Card title="Filtros – Clientes" right={<></>}>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={clientsFilterClientId}
                onChange={(e) => setClientsFilterClientId(e.target.value as any)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="all">Todos os clientes</option>
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={clientsFilterHealth}
                onChange={(e) => setClientsFilterHealth((e.target.value || "all") as any)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="all">Todas as saúdes</option>
                {(["Saudável", "Atenção", "Crítico"] as const).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <select
                value={clientsFilterPriority}
                onChange={(e) => setClientsFilterPriority((e.target.value || "all") as any)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="all">Todas as prioridades</option>
                {(["Alta", "Média", "Baixa"] as const).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="text-xs text-zinc-500">Ordenação: mais atualizado • prioridade</div>
            </div>
          </Card>

          <div className="mb-3 mt-2 flex items-center justify-end">
            <button
              onClick={() => {
                setExpandAllSubprojects((prev) => {
                  const next = !prev;
                  // when toggling, set all current subprojects accordingly
                  setSubExpanded((curr) => {
                    const nextMap: Record<string, boolean> = {};
                    for (const sp of data.subprojects) nextMap[sp.id] = next;
                    return nextMap;
                  });
                  return next;
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/60 px-3 py-2 text-sm hover:bg-zinc-900 cursor-pointer"
            >
              {expandAllSubprojects ? (
                <>
                  <ChevronDown className="h-4 w-4" /> Recolher todos
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4" /> Expandir todos
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {clientsList.map((client, idx) => (
              <motion.div key={client.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: idx * 0.03 }}>
                <Card
                  title={
                    <span className="text-[15px]">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: client.color || "#64748b" }} />
                      {client.name}
                    </span>
                  }
                  right={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEventModal(client.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900 cursor-pointer"
                      >
                        + Evento
                      </button>
                      <button
                        onClick={() => openEditClient(client.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900 cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => addSubproject(client.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Subprojeto
                      </button>
                    </div>
                  }
                >
                  <div className="mb-3 grid grid-cols-2 gap-3 text-[13px] text-zinc-400">
                    <div>
                      <span className="text-zinc-500">Saúde: </span>
                      <Badge color={client.health === "Crítico" ? "bg-rose-600" : client.health === "Atenção" ? "bg-amber-600" : "bg-emerald-600"}>
                        {client.health || "—"}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-zinc-500">Prioridade: </span>
                      {client.priority || "—"}
                    </div>
                    <div>
                      <span className="text-zinc-500">Contato: </span>
                      {client.contact || "—"}
                    </div>
                    <div>
                      <span className="text-zinc-500">SLA: </span>
                      {client.contract || "—"}
                    </div>
                    <div>
                      <span className="text-zinc-500">Links: </span>
                      <span className="truncate">{client.links || "—"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Riscos: </span>
                      {client.risks || "—"}
                    </div>
                    <div>
                      <span className="text-zinc-500">Último contato: </span>
                      {client.lastTouch ? new Date(client.lastTouch).toLocaleDateString("pt-BR") : "—"}
                    </div>
                    <div>
                      <span className="text-zinc-500">Próx. follow-up: </span>
                      {client.nextFollowUp ? new Date(client.nextFollowUp).toLocaleDateString("pt-BR") : "—"}
                    </div>
                    <div className="col-span-2">
                      <span className="text-zinc-500">Observações: </span>
                      {client.notes || "—"}
                    </div>
                  </div>

                  {/* Subprojects table */}
                  <div className="mb-2 text-xs font-semibold text-zinc-300">Subprojetos</div>
                  <div className="mb-4 divide-y divide-zinc-800/60 overflow-hidden rounded-xl border border-zinc-800/60">
                    {data.subprojects
                      .filter((s) => s.clientId === client.id)
                      .map((sp) => (
                        <div key={sp.id} className="">
                          <div className="flex items-center justify-between p-3">
                            <button
                              onClick={() => setSubExpanded((m) => ({ ...m, [sp.id]: !(m[sp.id] ?? expandAllSubprojects) }))}
                              className="flex items-center gap-2 text-left cursor-pointer"
                            >
                              {subExpanded[sp.id] ?? expandAllSubprojects ? (
                                <ChevronDown className="h-4 w-4 text-zinc-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-zinc-400" />
                              )}
                              <span className="font-medium text-zinc-100 text-[15px] flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: client.color || "#64748b" }} />
                                {sp.name}
                              </span>
                            </button>
                            <div className="flex items-center gap-2">
                              <Badge color={sp.status === "Concluído" ? "bg-emerald-600" : sp.status === "Pausado" ? "bg-zinc-600" : "bg-indigo-600"}>
                                {sp.status}
                              </Badge>
                              <button
                                onClick={() => openEventModal(client.id, sp.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900 cursor-pointer"
                              >
                                + Evento
                              </button>
                              <button
                                onClick={() => openCreateTask(sp.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900 cursor-pointer"
                              >
                                <Plus className="h-3 w-3" /> Tarefa
                              </button>
                            </div>
                          </div>

                          {(subExpanded[sp.id] ?? expandAllSubprojects) && (
                            <div className="space-y-3 p-3 pt-0">
                              {data.tasks
                                .filter((t) => t.subprojectId === sp.id && t.status !== "Concluída")
                                .map((t) => (
                                  <div key={t.id} className="rounded-lg border border-zinc-800/60 bg-zinc-950 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="text-[15px] text-zinc-100 font-medium">{t.title}</div>
                                      <div className="flex flex-wrap items-center gap-3 gap-y-2">
                                        <select
                                          value={t.status}
                                          onChange={(e) => updateTask({ id: t.id, status: e.target.value as Status })}
                                          className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm shrink-0"
                                        >
                                          {columns.map((s) => (
                                            <option key={s} value={s}>
                                              {s}
                                            </option>
                                          ))}
                                        </select>
                                        <select
                                          value={t.priority}
                                          onChange={(e) => updateTask({ id: t.id, priority: e.target.value as Priority })}
                                          className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm shrink-0"
                                        >
                                          {(["Alta", "Média", "Baixa"] as Priority[]).map((p) => (
                                            <option key={p} value={p}>
                                              {p}
                                            </option>
                                          ))}
                                        </select>
                                        <input
                                          type="date"
                                          value={t.dueDate ? t.dueDate.slice(0, 10) : ""}
                                          onChange={(e) =>
                                            updateTask({
                                              id: t.id,
                                              dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                                            })
                                          }
                                          className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm shrink-0 [color-scheme:dark]"
                                        />
                                        <button
                                          onClick={() => openEditTask(t.id)}
                                          className="rounded-md border border-zinc-800 px-2 py-1 text-xs hover:bg-zinc-900"
                                        >
                                          Editar
                                        </button>
                                      </div>
                                    </div>
                                    <div className="mt-1 grid grid-cols-2 gap-3 text-[13px] text-zinc-400">
                                      <div className="flex items-center gap-1">
                                        <span>Resp.:</span>
                                        <select
                                          value={t.assigneeId || ""}
                                          onChange={(e) => updateTask({ id: t.id, assigneeId: e.target.value || undefined })}
                                          className="w-52 rounded border border-zinc-800 bg-zinc-950 px-2 py-1"
                                        >
                                          <option value="">—</option>
                                          {(data.collaborators ?? []).map((u) => (
                                            <option key={u.id} value={u.id}>
                                              {u.name} ({u.area})
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        Tipo: {t.workType} • Origem: {t.origin}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              {data.tasks.filter((t) => t.subprojectId === sp.id && t.status !== "Concluída").length === 0 && (
                                <div className="text-xs text-zinc-500">Sem tarefas em aberto.</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    {data.subprojects.filter((s) => s.clientId === client.id).length === 0 && (
                      <div className="p-3 text-xs text-zinc-500">Sem subprojetos ainda.</div>
                    )}
                  </div>

                  {/* Último follow-up */}
                  <div className="mb-2 text-xs font-semibold text-zinc-300">Último follow-up</div>
                  <div className="mb-4 overflow-hidden rounded-xl border border-zinc-800/60">
                    {(() => {
                      const ev = data.events
                        .filter((e) => e.clientId === client.id && e.followUpAt)
                        .sort((a, b) => b.followUpAt!.localeCompare(a.followUpAt!))[0];
                      if (!ev) return <div className="px-3 py-3 text-xs text-zinc-500">Nenhum follow-up cadastrado.</div>;
                      return (
                        <div className="flex items-center justify-between px-3 py-2 text-sm">
                          <div>
                            <div className="font-medium text-zinc-200 inline-flex items-center gap-2">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: data.clients.find((c) => c.id === ev.clientId)?.color || "#64748b" }}
                              />
                              {ev.summary}
                            </div>
                            {ev.nextStep && <div className="text-zinc-400 text-xs">Próximo passo: {ev.nextStep}</div>}
                          </div>
                          <div className="text-right text-xs text-zinc-500">
                            <div>{new Date(ev.followUpAt!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
                            {ev.owner && <div>Resp.: {ev.owner}</div>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Card title="Clientes">
            <div className="space-y-1">
              <button
                className={clsx(
                  "w-full rounded-lg px-3 py-1.5 text-left text-sm cursor-pointer",
                  timelineClientId === "all" ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-900"
                )}
                onClick={() => {
                  setTimelineClientId("all");
                  setTimelineSubprojectId(null);
                }}
              >
                Todos
              </button>
              {data.clients.map((c) => {
                const subs = data.subprojects.filter((s) => s.clientId === c.id);
                return (
                  <div key={c.id}>
                    <button
                      className={clsx(
                        "w-full rounded-lg px-3 py-1.5 text-left text-sm cursor-pointer",
                        timelineClientId === c.id ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-900"
                      )}
                      onClick={() => {
                        setTimelineClientId(c.id);
                        setTimelineSubprojectId(null);
                      }}
                    >
                      {c.name}
                    </button>
                    {timelineClientId === c.id && (
                      <div className="mt-1 space-y-1 pl-4">
                        <button
                          className={clsx(
                            "w-full rounded-lg px-3 py-1.5 text-left text-xs cursor-pointer",
                            timelineSubprojectId === null ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-900"
                          )}
                          onClick={() => setTimelineSubprojectId(null)}
                        >
                          Todos os subprojetos
                        </button>
                        {subs.map((s) => (
                          <button
                            key={s.id}
                            className={clsx(
                              "w-full rounded-lg px-3 py-1.5 text-left text-xs cursor-pointer",
                              timelineSubprojectId === s.id ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-900"
                            )}
                            onClick={() => setTimelineSubprojectId(s.id)}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="md:col-span-4">
            <Card
              title={timelineClientId === "all" ? "Follow-ups por data" : `Follow-ups — ${data.clients.find((c) => c.id === timelineClientId)?.name}`}
              right={
                timelineClientId !== "all" && (
                  <button
                    onClick={() => openFollowUpModal(timelineClientId as string)}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900"
                  >
                    + Follow-up
                  </button>
                )
              }
            >
              {(() => {
                const list = data.events.filter(
                  (e) =>
                    e.followUpAt &&
                    (timelineClientId === "all" ? true : e.clientId === timelineClientId) &&
                    (timelineSubprojectId ? e.subprojectId === timelineSubprojectId : true)
                );
                if (list.length === 0) return <div className="text-center text-xs text-zinc-500">Nenhum follow-up.</div>;
                const groups = new Map<string, EventItem[]>();
                for (const ev of list) {
                  const k = ev.followUpAt!.slice(0, 10);
                  const arr = groups.get(k) || [];
                  arr.push(ev);
                  groups.set(k, arr);
                }
                const orderedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
                return (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {orderedKeys.map((k, idx) => (
                      <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: idx * 0.03 }}>
                        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
                          <div className="flex items-center justify-between border-b border-zinc-800/60 px-3 py-2">
                            <div className="text-sm font-medium text-zinc-200">{new Date(k).toLocaleDateString("pt-BR")}</div>
                            <Badge color="bg-zinc-700">{groups.get(k)!.length}</Badge>
                          </div>
                          <div className="space-y-2 p-3">
                            {groups
                              .get(k)!
                              .sort((a, b) => b.followUpAt!.localeCompare(a.followUpAt!))
                              .map((e) => (
                                <div key={e.id} className="rounded-lg border border-zinc-800/60 bg-zinc-950 p-2 text-xs">
                                  <div className="mb-1 flex items-center justify-between">
                                    <div className="font-medium text-zinc-100">{e.summary}</div>
                                    <div className="text-zinc-500">
                                      {new Date(e.followUpAt!).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                                    </div>
                                  </div>
                                  <div className="text-zinc-400">
                                    <span className="mr-2 inline-flex items-center gap-2">
                                      <span
                                        className="inline-block h-2 w-2 rounded-full"
                                        style={{ backgroundColor: data.clients.find((c) => c.id === e.clientId)?.color || "#64748b" }}
                                      />
                                      {data.clients.find((c) => c.id === e.clientId)?.name}
                                    </span>
                                    {e.subprojectId && <span className="mr-2">| {data.subprojects.find((s) => s.id === e.subprojectId)?.name}</span>}
                                    {e.owner && <span className="mr-2">| Resp.: {e.owner}</span>}
                                    {e.owners && e.owners.length > 0 && (
                                      <span className="mr-2">
                                        | Resp.:{" "}
                                        {e.owners
                                          .map((id) => data.collaborators.find((u) => u.id === id)?.name)
                                          .filter(Boolean)
                                          .join(", ")}
                                      </span>
                                    )}
                                  </div>
                                  {e.nextStep && <div className="mt-1 text-zinc-300">Próximo passo: {e.nextStep}</div>}
                                  <div className="mt-2 flex items-center gap-2">
                                    {timelineClientId !== "all" && (
                                      <button
                                        onClick={() => openFollowUpModal(e.clientId, e.subprojectId)}
                                        className="rounded-lg border border-zinc-800 px-2 py-1 text-xs hover:bg-zinc-900"
                                      >
                                        Novo
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditingEventId(e.id);
                                        setIsEventModalOpen(true);
                                        setEventDraft({
                                          clientId: e.clientId,
                                          subprojectId: e.subprojectId,
                                          type: e.type,
                                          summary: e.summary,
                                          when: e.when || e.createdAt,
                                          details: e.details,
                                          nextStep: e.nextStep,
                                          owners: e.owners || (e.owner ? [e.owner] : []),
                                          links: e.links,
                                          followUpAt: e.followUpAt,
                                        });
                                      }}
                                      className="rounded-lg border border-zinc-800 px-2 py-1 text-xs hover:bg-zinc-900"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => deleteEvent(e.id)}
                                      className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-950"
                                    >
                                      Excluir
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                );
              })()}
            </Card>
          </div>
        </div>
      )}

      {tab === "flow" && (
        <div className="space-y-4">
          <Card title="Flow de Follow-ups" right={<Calendar className="h-4 w-4 text-zinc-400" />}>
            <div className="text-sm text-zinc-400 mb-3">Visão em fluxo: cliente → follow-ups (ordem cronológica). Clique nos cartões para editar.</div>
            <div className="space-y-8">
              {data.clients.map((client, idx) => {
                const allClientEvents = data.events.filter((e) => e.clientId === client.id && e.followUpAt);
                if (allClientEvents.length === 0) return null;

                const subs = data.subprojects.filter((s) => s.clientId === client.id);
                const generalEvents = allClientEvents.filter((e) => !e.subprojectId).sort((a, b) => (a.followUpAt || "").localeCompare(b.followUpAt || ""));

                const lanes: Array<{
                  key: string;
                  label: string;
                  color: string;
                  events: typeof allClientEvents;
                }> = [];

                if (generalEvents.length) {
                  lanes.push({ key: `${client.id}-general`, label: "Cliente", color: client.color || "#a3a3a3", events: generalEvents });
                }
                for (const sp of subs) {
                  const evs = allClientEvents.filter((e) => e.subprojectId === sp.id).sort((a, b) => (a.followUpAt || "").localeCompare(b.followUpAt || ""));
                  if (evs.length) lanes.push({ key: sp.id, label: sp.name, color: client.color || "#f59e0b", events: evs });
                }

                const totalCount = lanes.reduce((acc, l) => acc + l.events.length, 0);

                return (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className="overflow-hidden rounded-2xl border border-zinc-800/60"
                  >
                    <div className="flex items-center justify-between p-3 border-b border-zinc-800/60">
                      <div className="flex items-center gap-3">
                        <div
                          className="shrink-0 rounded-lg px-4 py-6 text-zinc-900 text-sm font-semibold"
                          style={{ backgroundColor: client.color || "#f59e0b" }}
                        >
                          {client.name}
                        </div>
                        <div className="text-xs text-zinc-500">{totalCount} follow-up(s)</div>
                      </div>
                    </div>
                    <div className="relative p-4 space-y-6">
                      {lanes.map((lane) => (
                        <div key={lane.key} className="">
                          <div className="mb-2 inline-flex items-center gap-2">
                            <div
                              className="rounded-md px-3 py-2 text-zinc-900 text-xs font-semibold"
                              style={{ backgroundColor: lane.color }}
                              title={lane.label}
                            >
                              {lane.label}
                            </div>
                            <div className="text-[10px] text-zinc-500">{lane.events.length} itens</div>
                            <button
                              onClick={() => openFollowUpModal(client.id, lane.key === `${client.id}-general` ? undefined : lane.key)}
                              className="ml-2 rounded-md border border-zinc-800/60 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-900 cursor-pointer"
                            >
                              + Follow-up
                            </button>
                          </div>
                          <div
                            className="grid auto-cols-max grid-flow-col gap-6 overflow-x-auto pb-2 flow-scroll"
                            ref={(el) => {
                              if (el && flowInitScrolled.current && !flowInitScrolled.current.has(el)) {
                                el.scrollLeft = el.scrollWidth;
                                flowInitScrolled.current.add(el);
                              }
                            }}
                          >
                            {lane.events.map((e, idx) => (
                              <div key={e.id} className="flex items-center">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(ev) => {
                                    if (ev.key === "Enter" || ev.key === " ") {
                                      ev.preventDefault();
                                      setEditingEventId(e.id);
                                      setIsEventModalOpen(true);
                                      setEventDraft({
                                        clientId: e.clientId,
                                        subprojectId: e.subprojectId,
                                        type: e.type,
                                        summary: e.summary,
                                        when: e.when || e.createdAt,
                                        details: e.details,
                                        nextStep: e.nextStep,
                                        owners: e.owners || (e.owner ? [e.owner] : []),
                                        links: e.links,
                                        followUpAt: e.followUpAt,
                                      });
                                    }
                                  }}
                                  onClick={() => {
                                    setEditingEventId(e.id);
                                    setIsEventModalOpen(true);
                                    setEventDraft({
                                      clientId: e.clientId,
                                      subprojectId: e.subprojectId,
                                      type: e.type,
                                      summary: e.summary,
                                      when: e.when || e.createdAt,
                                      details: e.details,
                                      nextStep: e.nextStep,
                                      owners: e.owners || (e.owner ? [e.owner] : []),
                                      links: e.links,
                                      followUpAt: e.followUpAt,
                                    });
                                  }}
                                  className="rounded-xl border border-zinc-800/60 p-3 text-left text-xs hover:bg-zinc-900/40 min-w-[220px] max-w-[240px] min-h-[160px] cursor-pointer relative"
                                  style={{ backgroundColor: `${client.color || "#64748b"}1A` }}
                                >
                                  {e.isAlert && (
                                    <div className="absolute right-2 top-2 text-amber-400" title="Alerta">
                                      <AlertTriangle className="h-4 w-4" />
                                    </div>
                                  )}
                                  <div className="mb-2">
                                    <div className="text-zinc-300 text-[12px] font-semibold text-center">
                                      {new Date(e.followUpAt!).toLocaleDateString("pt-BR")}
                                    </div>
                                    <div className="mt-1 font-medium text-zinc-100 break-words whitespace-pre-wrap">{e.summary}</div>
                                  </div>
                                  {e.details && <div className="text-zinc-300 text-[13px] leading-5 line-clamp-4 mb-2 whitespace-pre-wrap">{e.details}</div>}
                                  <div className="text-zinc-400 text-[11px]">
                                    {e.subprojectId && <span className="mr-2">{data.subprojects.find((s) => s.id === e.subprojectId)?.name}</span>}
                                    {e.owners && e.owners.length > 0 && (
                                      <span className="block truncate">
                                        Resp.:{" "}
                                        {e.owners
                                          .map((id) => data.collaborators.find((u) => u.id === id)?.name)
                                          .filter(Boolean)
                                          .join(", ")}
                                      </span>
                                    )}
                                    {e.nextStep && <span className="block text-zinc-300">Próx.: {e.nextStep}</span>}
                                  </div>
                                  <div className="absolute -right-2 -bottom-2">
                                    <button
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        if (confirm("Excluir follow-up?")) deleteEvent(e.id);
                                      }}
                                      className="rounded-full bg-rose-900/80 text-rose-100 border border-rose-900 px-2 py-1 text-[10px] hover:bg-rose-900"
                                    >
                                      Excluir
                                    </button>
                                  </div>
                                </div>
                                {idx < lane.events.length - 1 && (
                                  <div className="mx-3 text-zinc-500">
                                    <ArrowRight className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
              {data.clients.every((c) => data.events.filter((e) => e.clientId === c.id && e.followUpAt).length === 0) && (
                <div className="text-center text-xs text-zinc-500">Sem follow-ups para exibir.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "capacity" && (
        <div className="space-y-4">
          <Card title="Capacidade do time" right={<Users className="h-4 w-4 text-zinc-400" />}>
            {(() => {
              const activeTasks = data.tasks.filter((t) => t.status !== "Concluída");
              const total = activeTasks.length;
              if ((data.collaborators ?? []).length === 0) return <div className="text-sm text-zinc-400">Nenhum colaborador cadastrado.</div>;
              return (
                <div className="space-y-4">
                  <div className="text-xs text-zinc-500">Tarefas ativas: {total}</div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {(data.collaborators ?? []).map((u, idx) => {
                      const list = activeTasks.filter((t) => t.assigneeId === u.id);
                      const pct = total > 0 ? Math.round((list.length / total) * 100) : 0;
                      return (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                          className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-[15px] font-semibold text-zinc-100">
                              {u.name} <span className="text-xs font-normal text-zinc-400">({u.area})</span>
                            </div>
                            <div className="text-xs text-zinc-400">
                              {list.length}/{total} • {pct}%
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-3 text-xs text-zinc-400">Tarefas</div>
                          <div className="mt-1 flex max-h-40 flex-wrap gap-1 overflow-auto pr-1">
                            {list.length > 0 ? (
                              list.map((t) => (
                                <span key={t.id} className="rounded-md border border-zinc-800/60 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                                  {t.title}
                                </span>
                              ))
                            ) : (
                              <div className="text-xs text-zinc-500">Sem tarefas atribuídas</div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {tab === "collaborators" && (
        <div className="grid grid-cols-1 gap-4">
          <Card
            title="Colaboradores"
            right={
              <button
                onClick={addCollaborator}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
              >
                <Plus className="h-4 w-4" /> Novo colaborador
              </button>
            }
          >
            <div className="overflow-hidden rounded-xl border border-zinc-800/60">
              <div className="grid grid-cols-12 gap-2 border-b border-zinc-800/60 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-400">
                <div className="col-span-6">Nome</div>
                <div className="col-span-4">Área</div>
                <div className="col-span-2 text-right">Ações</div>
              </div>
              {(data.collaborators ?? []).map((u) => (
                <div key={u.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-sm">
                  <div className="col-span-6">
                    <input
                      value={u.name}
                      onChange={(e) => updateCollaborator({ id: u.id, name: e.target.value })}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1"
                    />
                  </div>
                  <div className="col-span-4">
                    <select
                      value={u.area}
                      onChange={(e) => updateCollaborator({ id: u.id, area: e.target.value as Area })}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1"
                    >
                      {AREAS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      onClick={() => deleteCollaborator(u.id)}
                      className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-950"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
              {(data.collaborators ?? []).length === 0 && <div className="px-3 py-4 text-center text-xs text-zinc-500">Nenhum colaborador cadastrado.</div>}
            </div>
          </Card>
        </div>
      )}

      {/* Follow-up Modal */}
      {isFollowUpModalOpen && followUpDraft && (
        <Modal
          title="Novo follow-up"
          onClose={() => {
            setIsFollowUpModalOpen(false);
            setFollowUpDraft(null);
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsFollowUpModalOpen(false);
                  setFollowUpDraft(null);
                }}
                className="rounded-lg border border-zinc-800/60 px-3 py-1.5 text-sm hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button onClick={saveFollowUp} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
                Salvar
              </button>
            </div>
          }
        >
          <FollowUpForm
            draft={followUpDraft}
            onChange={(k, v) => setFollowUpDraft((d) => (d ? { ...d, [k]: v } : d))}
            collaborators={data.collaborators}
            clients={data.clients}
            subprojects={data.subprojects}
          />
        </Modal>
      )}

      {/* Subproject Create Modal */}
      {creatingSubproject.draft && (
        <Modal
          title="Novo subprojeto"
          onClose={() => setCreatingSubproject({ clientId: null, draft: null })}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setCreatingSubproject({ clientId: null, draft: null })}
                className="rounded-lg border border-zinc-800/60 px-3 py-1.5 text-sm hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const d = creatingSubproject.draft!;
                  if (!d.name.trim()) return alert("Informe o nome do subprojeto");
                  (async () => {
                    if (remoteReady) await apiCreate<Subproject>("subprojects", d);
                    setData((prev) => ({ ...prev, subprojects: [...prev.subprojects, d] }));
                  })();
                  setCreatingSubproject({ clientId: null, draft: null });
                }}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
              >
                Salvar
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Cliente</label>
                <select
                  value={creatingSubproject.draft!.clientId}
                  onChange={(e) => setCreatingSubproject((s) => ({ ...s, draft: s.draft ? { ...s.draft, clientId: e.target.value } : s.draft }))}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                >
                  {data.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Status</label>
                <select
                  value={creatingSubproject.draft!.status}
                  onChange={(e) => setCreatingSubproject((s) => ({ ...s, draft: s.draft ? { ...s.draft, status: e.target.value as any } : s.draft }))}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                >
                  {(["Ativo", "Pausado", "Concluído"] as const).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-zinc-400">Nome</label>
                <input
                  value={creatingSubproject.draft!.name}
                  onChange={(e) => setCreatingSubproject((s) => ({ ...s, draft: s.draft ? { ...s.draft, name: e.target.value } : s.draft }))}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Início</label>
                <input
                  type="date"
                  value={creatingSubproject.draft!.startDate ? creatingSubproject.draft!.startDate!.slice(0, 10) : ""}
                  onChange={(e) =>
                    setCreatingSubproject((s) => ({
                      ...s,
                      draft: s.draft ? { ...s.draft, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined } : s.draft,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Prazo</label>
                <input
                  type="date"
                  value={creatingSubproject.draft!.endDate ? creatingSubproject.draft!.endDate!.slice(0, 10) : ""}
                  onChange={(e) =>
                    setCreatingSubproject((s) => ({
                      ...s,
                      draft: s.draft ? { ...s.draft, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined } : s.draft,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm [color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Event Modal */}
      {isEventModalOpen && eventDraft && (
        <Modal
          title="Novo evento"
          onClose={() => {
            setIsEventModalOpen(false);
            setEventDraft(null);
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsEventModalOpen(false);
                  setEventDraft(null);
                }}
                className="rounded-lg border border-zinc-800/60 px-3 py-1.5 text-sm hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button onClick={saveEvent} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
                Salvar
              </button>
            </div>
          }
        >
          <EventCreateForm
            draft={eventDraft}
            onChange={(k, v) => setEventDraft((d) => (d ? { ...d, [k]: v } : d))}
            collaborators={data.collaborators}
            clients={data.clients}
            subprojects={data.subprojects}
          />
        </Modal>
      )}

      {/* Modais */}
      {isTaskCreateOpen && taskCreateDraft && (
        <Modal
          title="Nova tarefa"
          onClose={() => {
            setIsTaskCreateOpen(false);
            setTaskCreateDraft(null);
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsTaskCreateOpen(false);
                  setTaskCreateDraft(null);
                }}
                className="rounded-lg border border-zinc-800/60 px-3 py-1.5 text-sm hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button onClick={saveCreateTask} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
                Salvar
              </button>
            </div>
          }
        >
          <TaskEditForm draft={taskCreateDraft} onChange={(k, v) => setTaskCreateDraft((d) => (d ? { ...d, [k]: v } : d))} collaborators={data.collaborators} />
        </Modal>
      )}
      {creatingClient && newClientDraft && (
        <Modal
          title="Novo cliente"
          onClose={() => {
            setCreatingClient(false);
            setNewClientDraft(null);
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setCreatingClient(false);
                  setNewClientDraft(null);
                }}
                className="rounded-lg border border-zinc-800/60 px-3 py-1.5 text-sm hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!newClientDraft?.name?.trim()) return alert("Informe o nome do cliente");
                  const toSave: Client = { ...newClientDraft, lastTouch: new Date().toISOString() };
                  (async () => {
                    if (remoteReady) await apiCreate<Client>("clients", toSave);
                    setData((d) => ({ ...d, clients: [...d.clients, toSave] }));
                  })();
                  setCreatingClient(false);
                  setNewClientDraft(null);
                }}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
              >
                Salvar
              </button>
            </div>
          }
        >
          <ClientCreateForm draft={newClientDraft} onChange={(k, v) => setNewClientDraft((c) => (c ? { ...c, [k]: v } : c))} />
        </Modal>
      )}
      {editingTaskId && taskDraft && (
        <Modal
          title={`Editar tarefa — ${taskDraft.title}`}
          onClose={() => {
            setEditingTaskId(null);
            setTaskDraft(null);
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setEditingTaskId(null);
                  setTaskDraft(null);
                }}
                className="rounded-lg border border-zinc-800/60 px-3 py-1.5 text-sm hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button onClick={saveTaskEdit} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
                Salvar
              </button>
            </div>
          }
        >
          <TaskEditForm draft={taskDraft} onChange={updateTaskDraft} collaborators={data.collaborators} />
        </Modal>
      )}

      {editingClientId && clientDraft && (
        <Modal
          title={`Editar cliente — ${clientDraft.name}`}
          onClose={() => {
            setEditingClientId(null);
            setClientDraft(null);
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setEditingClientId(null);
                  setClientDraft(null);
                }}
                className="rounded-lg border border-zinc-800/60 px-3 py-1.5 text-sm hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button onClick={saveClientEdit} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
                Salvar
              </button>
            </div>
          }
        >
          <ClientEditForm draft={clientDraft} onChange={updateClientDraft} />
        </Modal>
      )}

      {/* Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-zinc-800/60 pt-4 text-xs text-zinc-500">
        <div>Salvo em JSON local • Pronto para migrar para MongoDB via API</div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Save className="h-3 w-3" /> autosave
          </span>
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> lembrete: faça export da base semanalmente
          </span>
        </div>
      </div>

      {/* Reorder Tabs Modal */}
      {isReorderTabsOpen && tabOrderDraft && (
        <Modal
          title="Reordenar abas"
          onClose={() => {
            setIsReorderTabsOpen(false);
            setTabOrderDraft(null);
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsReorderTabsOpen(false);
                  setTabOrderDraft(null);
                }}
                className="rounded-lg border border-zinc-800/60 px-3 py-1.5 text-sm hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (tabOrderDraft) setTabsOrder(tabOrderDraft);
                  setIsReorderTabsOpen(false);
                  setTabOrderDraft(null);
                }}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
              >
                Salvar
              </button>
            </div>
          }
        >
          <div className="space-y-2">
            {tabOrderDraft.map((id, idx) => (
              <div key={id} className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 py-2 text-sm">
                <div className="inline-flex items-center gap-2">
                  <TabIcon id={id} /> {TAB_LABEL[id]}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (idx === 0) return;
                      const next = [...tabOrderDraft];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      setTabOrderDraft(next);
                    }}
                    className="rounded-md border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => {
                      if (idx === tabOrderDraft.length - 1) return;
                      const next = [...tabOrderDraft];
                      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                      setTabOrderDraft(next);
                    }}
                    className="rounded-md border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// Edit Client Modal
function ClientEditForm({ draft, onChange }: { draft: Client; onChange: <K extends keyof Client>(k: K, v: Client[K]) => void }) {
  const PRIORITIES: Array<Client["priority"]> = ["Alta", "Média", "Baixa"];
  const HEALTHS: Array<Client["health"]> = ["Saudável", "Atenção", "Crítico"];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Nome</label>
          <input
            value={draft.name}
            onChange={(e) => onChange("name", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Contato</label>
          <input
            value={draft.contact || ""}
            onChange={(e) => onChange("contact", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Cor (hex)</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.color || "#3b82f6"}
              onChange={(e) => onChange("color", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border border-zinc-800 bg-zinc-950"
            />
            <input
              value={draft.color || "#3b82f6"}
              onChange={(e) => onChange("color", e.target.value)}
              className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="#RRGGBB"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Canais</label>
          <input
            value={draft.channels || ""}
            onChange={(e) => onChange("channels", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Prioridade</label>
          <select
            value={draft.priority || "Média"}
            onChange={(e) => onChange("priority", e.target.value as any)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {PRIORITIES.map((p) => (
              <option key={p || "-"} value={p || ""}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Contrato / SLA</label>
          <input
            value={draft.contract || ""}
            onChange={(e) => onChange("contract", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Links</label>
          <input
            value={draft.links || ""}
            onChange={(e) => onChange("links", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Saúde</label>
          <select
            value={draft.health || "Saudável"}
            onChange={(e) => onChange("health", e.target.value as any)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {HEALTHS.map((h) => (
              <option key={h || "-"} value={h || ""}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Próx. follow-up</label>
          <input
            type="date"
            value={draft.nextFollowUp ? draft.nextFollowUp.slice(0, 10) : ""}
            onChange={(e) => onChange("nextFollowUp", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Último contato (auto)</label>
          <input
            readOnly
            value={draft.lastTouch ? new Date(draft.lastTouch).toLocaleString("pt-BR") : "—"}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Horas/mês</label>
          <input
            value={draft.monthHours || ""}
            onChange={(e) => onChange("monthHours", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Riscos</label>
        <input
          value={draft.risks || ""}
          onChange={(e) => onChange("risks", e.target.value)}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Observações</label>
        <textarea
          value={draft.notes || ""}
          onChange={(e) => onChange("notes", e.target.value)}
          className="h-24 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

function ClientCreateForm({ draft, onChange }: { draft: Client; onChange: <K extends keyof Client>(k: K, v: Client[K]) => void }) {
  const PRIORITIES: Array<Client["priority"]> = ["Alta", "Média", "Baixa"];
  const HEALTHS: Array<Client["health"]> = ["Saudável", "Atenção", "Crítico"];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Nome</label>
          <input
            value={draft.name}
            onChange={(e) => onChange("name", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Contato</label>
          <input
            value={draft.contact || ""}
            onChange={(e) => onChange("contact", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Canais</label>
          <input
            value={draft.channels || ""}
            onChange={(e) => onChange("channels", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Prioridade</label>
          <select
            value={draft.priority || "Média"}
            onChange={(e) => onChange("priority", e.target.value as any)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {PRIORITIES.map((p) => (
              <option key={p || "-"} value={p || ""}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Contrato / SLA</label>
          <input
            value={draft.contract || ""}
            onChange={(e) => onChange("contract", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Links</label>
          <input
            value={draft.links || ""}
            onChange={(e) => onChange("links", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Saúde</label>
          <select
            value={draft.health || "Saudável"}
            onChange={(e) => onChange("health", e.target.value as any)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {HEALTHS.map((h) => (
              <option key={h || "-"} value={h || ""}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Próx. follow-up</label>
          <input
            type="date"
            value={draft.nextFollowUp ? draft.nextFollowUp.slice(0, 10) : ""}
            onChange={(e) => onChange("nextFollowUp", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Horas/mês</label>
          <input
            value={draft.monthHours || ""}
            onChange={(e) => onChange("monthHours", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Riscos</label>
        <input
          value={draft.risks || ""}
          onChange={(e) => onChange("risks", e.target.value)}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Observações</label>
        <textarea
          value={draft.notes || ""}
          onChange={(e) => onChange("notes", e.target.value)}
          className="h-24 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

function TaskEditForm({
  draft,
  onChange,
  collaborators,
}: {
  draft: Task;
  onChange: <K extends keyof Task>(k: K, v: Task[K]) => void;
  collaborators: Collaborator[];
}) {
  const PRIORITIES: Priority[] = ["Alta", "Média", "Baixa"];
  const STATUSES: Status[] = ["Pendente", "Em andamento", "Aguardando cliente", "Concluída"];
  const WORK_TYPES: WorkType[] = ["Site", "App", "SEO", "Infra", "Outros"];
  const ORIGINS: DemandOrigin[] = ["Cliente", "Interno", "Outro projeto"];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-zinc-400">Título</label>
          <input
            value={draft.title}
            onChange={(e) => onChange("title", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Status</label>
          <select
            value={draft.status}
            onChange={(e) => onChange("status", e.target.value as Status)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Prioridade</label>
          <select
            value={draft.priority}
            onChange={(e) => onChange("priority", e.target.value as Priority)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Responsável</label>
          <select
            value={draft.assigneeId || ""}
            onChange={(e) => onChange("assigneeId", e.target.value || undefined)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {collaborators.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.area})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Prazo</label>
          <input
            type="date"
            value={draft.dueDate ? draft.dueDate.slice(0, 10) : ""}
            onChange={(e) => onChange("dueDate", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Início</label>
          <input
            type="date"
            value={draft.startDate ? draft.startDate.slice(0, 10) : ""}
            onChange={(e) => onChange("startDate", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Tipo de trabalho</label>
          <select
            value={draft.workType}
            onChange={(e) => onChange("workType", e.target.value as WorkType)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {WORK_TYPES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Origem</label>
          <select
            value={draft.origin}
            onChange={(e) => onChange("origin", e.target.value as DemandOrigin)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        {/* relação interna automática - oculto para usuário */}
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-zinc-400">Descrição</label>
          <textarea
            value={draft.description || ""}
            onChange={(e) => onChange("description", e.target.value)}
            className="h-28 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function FollowUpForm({
  draft,
  onChange,
  collaborators,
  clients,
  subprojects,
}: {
  draft: {
    clientId: string;
    subprojectId?: string;
    type: EventType;
    followUpAt: string;
    details?: string;
    pendingFrom: "Cliente" | "Equipe" | "Ambos" | "Nenhum";
    owners: string[];
    isAlert: boolean;
  };
  onChange: <K extends keyof any>(k: any, v: any) => void;
  collaborators: Collaborator[];
  clients: Client[];
  subprojects: Subproject[];
}) {
  const TYPES: EventType[] = [
    "Reunião",
    "Cobrança",
    "Aprovação",
    "Entrega",
    "Decisão",
    "Bloqueio",
    "Atualização",
    "Risco",
    "Alinhamento interno",
    "Contato sem retorno",
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Cliente</label>
          <select
            value={draft.clientId}
            onChange={(e) => onChange("clientId", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Subprojeto</label>
          <select
            value={draft.subprojectId || ""}
            onChange={(e) => onChange("subprojectId", e.target.value || undefined)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {subprojects
              .filter((s) => s.clientId === draft.clientId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Data</label>
          <input
            type="date"
            value={draft.followUpAt.slice(0, 10)}
            onChange={(e) => onChange("followUpAt", new Date(e.target.value).toISOString())}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Motivo</label>
          <select
            value={draft.type}
            onChange={(e) => onChange("type", e.target.value as EventType)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Pendência</label>
          <select
            value={draft.pendingFrom}
            onChange={(e) => onChange("pendingFrom", e.target.value as any)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {(["Cliente", "Equipe", "Ambos", "Nenhum"] as const).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Responsáveis</label>
          <div className="flex flex-wrap gap-2 rounded-md border border-zinc-800 bg-zinc-950 p-2">
            {collaborators.map((u) => {
              const active = draft.owners.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onChange("owners", active ? draft.owners.filter((id) => id !== u.id) : [...draft.owners, u.id])}
                  className={"rounded-full px-3 py-1 text-xs " + (active ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700")}
                >
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Alerta</label>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={draft.isAlert} onChange={(e) => onChange("isAlert", e.target.checked)} />
            Marcar como alerta
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Descrição</label>
        <textarea
          value={draft.details || ""}
          onChange={(e) => onChange("details", e.target.value)}
          className="h-28 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

function EventCreateForm({
  draft,
  onChange,
  collaborators,
  clients,
  subprojects,
}: {
  draft: {
    clientId: string;
    subprojectId?: string;
    type: EventType;
    summary: string;
    when: string;
    details?: string;
    nextStep?: string;
    owners: string[];
    links?: string;
    followUpAt?: string;
  };
  onChange: (k: string, v: any) => void;
  collaborators: Collaborator[];
  clients: Client[];
  subprojects: Subproject[];
}) {
  const TYPES: EventType[] = [
    "Reunião",
    "Cobrança",
    "Aprovação",
    "Entrega",
    "Decisão",
    "Bloqueio",
    "Atualização",
    "Risco",
    "Alinhamento interno",
    "Contato sem retorno",
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Cliente</label>
          <select
            value={draft.clientId}
            onChange={(e) => onChange("clientId", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Subprojeto</label>
          <select
            value={draft.subprojectId || ""}
            onChange={(e) => onChange("subprojectId", e.target.value || undefined)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {subprojects
              .filter((s) => s.clientId === draft.clientId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Motivo</label>
          <select
            value={draft.type}
            onChange={(e) => onChange("type", e.target.value as EventType)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Quando</label>
          <input
            type="datetime-local"
            value={draft.when.slice(0, 16)}
            onChange={(e) => onChange("when", new Date(e.target.value).toISOString())}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-zinc-400">Resumo</label>
          <input
            value={draft.summary}
            onChange={(e) => onChange("summary", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-zinc-400">Descrição</label>
          <textarea
            value={draft.details || ""}
            onChange={(e) => onChange("details", e.target.value)}
            className="h-28 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-zinc-400">Próximo passo</label>
          <input
            value={draft.nextStep || ""}
            onChange={(e) => onChange("nextStep", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Follow-up (opcional)</label>
          <input
            type="datetime-local"
            value={draft.followUpAt ? draft.followUpAt.slice(0, 16) : ""}
            onChange={(e) => onChange("followUpAt", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Links (opcional)</label>
          <input
            value={draft.links || ""}
            onChange={(e) => onChange("links", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-zinc-400">Responsáveis</label>
          <div className="flex flex-wrap gap-2 rounded-md border border-zinc-800 bg-zinc-950 p-2">
            {collaborators.map((u) => {
              const active = draft.owners.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onChange("owners", active ? draft.owners.filter((id) => id !== u.id) : [...draft.owners, u.id])}
                  className={"rounded-full px-3 py-1 text-xs " + (active ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700")}
                >
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ----------------------- MONGO (roadmap) -----------------------
 * 1) Crie /app/api/{clients,subprojects,tasks}/route.ts com GET/POST/PUT/DELETE usando MongoDB.
 * 2) Substitua jsonStore.load/save por chamadas fetch ao montar/sincronizar.
 * 3) Em produção, proteja as rotas (Auth) e valide payload (zod).
 *
 * Shapes sugeridos:
 * - clients: { _id, name, contact, channels, priority, contract, links, health, lastTouch, nextFollowUp, risks, monthHours, notes }
 * - subprojects: { _id, name, clientId, status, startDate, endDate }
 * - tasks: { _id, title, status, priority, assigneeId, dueDate, workType, origin, description, startDate, relationId, subprojectId }
 * - events: { _id, createdAt, when, type, summary, details, clientId, subprojectId, taskId, nextStep, owner, followUpAt, links }
 */
