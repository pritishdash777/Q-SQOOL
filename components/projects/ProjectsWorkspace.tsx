"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Cloud, Download, FolderOpen, Plus, RefreshCw, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  AUTH_CHANGED, getStoredToken, getCachedUser, getCurrentUser, getProjects, createProject, updateProject, deleteProject,
  getCollaborators, addCollaborator, removeCollaborator, type Collaborator,
} from '@/lib/auth-api';
import type { CloudProject } from '@/lib/auth-types';
import type { Circuit, LocalProject, Page, SDK } from '@/lib/quantum-types';
import { copyLocalProject, isCircuit, projectStorageKey, readLocalProjects } from '@/lib/project-storage';

type Props = {
  circuit: Circuit;
  setCircuit: React.Dispatch<React.SetStateAction<Circuit>>;
  navigate: (page: Page) => void;
  generateCode: (circuit: Circuit, sdk: SDK) => string;
};
const actionClass = 'rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40';
const snapshot = (circuit: Circuit) => ({ id: Date.now(), savedAt: new Date().toISOString(), circuit: structuredClone(circuit) });
function fromCloud(project: CloudProject, previous?: LocalProject): LocalProject {
  return {
    id: project.id, cloudId: project.id, permission: project.permission, name: project.name,
    circuit: project.circuit_json, updatedAt: project.updated_at,
    versions: previous?.versions || [snapshot(project.circuit_json)],
  };
}
function subscribeAuth(listener: () => void) {
  window.addEventListener(AUTH_CHANGED, listener);
  return () => window.removeEventListener(AUTH_CHANGED, listener);
}
function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
}

export function ProjectsWorkspace(props: Props) {
  const token = useSyncExternalStore(subscribeAuth, getStoredToken, () => null);
  return <AccountProjects key={token || 'guest'} {...props} token={token} />;
}

function AccountProjects({ circuit, setCircuit, navigate, generateCode, token }: Props & { token: string | null }) {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('My quantum circuit');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<LocalProject | null>(null);
  const [sharing, setSharing] = useState<LocalProject | null>(null);
  const [deleting, setDeleting] = useState<LocalProject | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('edit');
  const [shareError, setShareError] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = useRef(false);
  const pending = useRef(false);
  const loadId = useRef(0);
  const shareId = useRef(0);
  const options = { token };
  const current = () => active.current && getStoredToken() === token;

  const load = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const request = ++loadId.current;
    const valid = () => active.current && getStoredToken() === token && request === loadId.current;
    try {
      const user = token ? getCachedUser() || await getCurrentUser({ token }) : null;
      if (!valid()) return;
      const scope = user?.id || 'guest';
      setUserId(scope);
      const local = readLocalProjects(localStorage, scope);
      setProjects(previous => [...previous.filter(project => project.cloudId), ...local]);
      setReady(true);
      setError('');
      if (token) {
        const cloud = await getProjects({ token });
        if (valid()) setProjects(previous => [...cloud.map(project => fromCloud(project, previous.find(item => item.cloudId === project.id))), ...local]);
      }
    } catch (err) {
      if (valid()) { setError(err instanceof Error ? err.message : 'Could not load projects.'); setReady(true); }
    } finally {
      pending.current = false;
      if (valid()) setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    active.current = true;
    void Promise.resolve().then(load);
    const refresh = () => { if (!pending.current) void load(); };
    window.addEventListener('online', refresh);
    return () => { active.current = false; window.removeEventListener('online', refresh); };
  }, [load]);

  const store = (next: LocalProject[]) => {
    if (!current() || !userId) return;
    localStorage.setItem(projectStorageKey(userId), JSON.stringify(next.filter(project => !project.cloudId)));
    setProjects(next);
  };
  const run = async (work: () => Promise<void> | void) => {
    if (pending.current || !current()) return;
    pending.current = true;
    ++loadId.current;
    setBusy(true); setError('');
    try { await work(); }
    catch (err) { if (current()) setError(err instanceof Error ? err.message : 'The project could not be saved. Please retry.'); }
    finally { pending.current = false; if (current()) setBusy(false); }
  };
  const create = (localOnly = false) => run(async () => {
    const title = name.trim() || 'Untitled circuit';
    if (token && online && !localOnly) {
      const saved = await createProject(title, circuit, 'Qiskit', options);
      if (!current()) return;
      setProjects(previous => [fromCloud(saved), ...previous]);
      toast.success('Project saved to cloud');
    } else {
      const local = copyLocalProject({ name: title, circuit }); local.name = title;
      store([local, ...projects]); toast.success('Project saved on this device');
    }
    setName('My quantum circuit');
  });
  const save = (project: LocalProject, changes: { name?: string; circuit?: Circuit }) => run(async () => {
    let updated = { ...project, ...changes, updatedAt: new Date().toISOString() };
    if (changes.circuit) updated.versions = [snapshot(changes.circuit), ...project.versions].slice(0, 10);
    if (project.cloudId) {
      const saved = await updateProject(project.cloudId, {
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.circuit ? { circuit_json: changes.circuit } : {}),
      }, options);
      if (!current()) return;
      updated = fromCloud(saved, updated);
      setProjects(previous => previous.map(item => item.id === project.id ? updated : item));
    } else store(projects.map(item => item.id === project.id ? updated : item));
    toast.success(project.cloudId ? 'Cloud project updated' : 'Local project updated');
  });
  const duplicate = (project: LocalProject, label = 'Copy') => run(() => {
    store([copyLocalProject(project, label), ...projects]); toast.success(`${label} saved on this device`);
  });
  const upload = (project: LocalProject) => run(async () => {
    const saved = await createProject(project.name, project.circuit, 'Qiskit', options);
    if (!current()) return;
    // Keep the draft as a recovery copy if browser storage is unavailable after upload.
    const next = projects.map(item => item.id === project.id ? fromCloud(saved, project) : item);
    setProjects(next);
    store(next);
    toast.success('Project saved to cloud');
  });
  const remove = () => deleting && run(async () => {
    if (deleting.cloudId) {
      await deleteProject(deleting.cloudId, options);
      if (!current()) return;
      setProjects(previous => previous.filter(item => item.id !== deleting.id));
    } else store(projects.filter(item => item.id !== deleting.id));
    setDeleting(null); toast.success('Project deleted');
  });
  const open = (project: LocalProject) => { setCircuit(structuredClone(project.circuit)); navigate('lab'); };
  const download = (project: LocalProject, format: 'JSON' | SDK) => {
    const content = format === 'JSON' ? JSON.stringify({ name: project.name, circuit: project.circuit }, null, 2) : generateCode(project.circuit, format);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `${project.name}.${format === 'JSON' ? 'json' : format === 'OpenQASM' ? 'qasm' : 'py'}`;
    link.click(); URL.revokeObjectURL(url);
  };
  const importJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    void run(async () => {
      const data = JSON.parse(await file.text());
      const imported: unknown = data?.circuit ?? data;
      if (!isCircuit(imported)) throw new Error('Choose a valid circuit JSON file with 1–5 qubits and supported gates.');
      if (!current()) return;
      const title = typeof data.name === 'string' ? data.name.slice(0, 100) : file.name.replace(/\.json$/i, '').slice(0, 100);
      const local = copyLocalProject({ name: title, circuit: imported }); local.name = title || 'Imported circuit';
      store([local, ...projects]); setCircuit(imported); toast.success('Circuit imported on this device');
    });
  };
  const openSharing = async (project: LocalProject) => {
    if (!project.cloudId || pending.current) return;
    const request = ++shareId.current;
    setSharing(project); setCollaborators([]); setInviteEmail(''); setPermission('edit'); setShareError(''); setShareLoading(true);
    try {
      const result = await getCollaborators(project.cloudId, options);
      if (current() && request === shareId.current) setCollaborators(result);
    } catch (err) {
      if (current() && request === shareId.current) setShareError(err instanceof Error ? err.message : 'Could not load collaborators.');
    } finally { if (current() && request === shareId.current) setShareLoading(false); }
  };
  const changeSharing = async (work: () => Promise<Collaborator[]>) => {
    if (pending.current || !current()) return;
    const request = shareId.current;
    pending.current = true; setBusy(true); setShareError('');
    try {
      const result = await work();
      if (current() && request === shareId.current) { setCollaborators(result); setInviteEmail(''); }
    } catch (err) {
      if (current() && request === shareId.current) setShareError(err instanceof Error ? err.message : 'Could not update collaborators.');
    } finally { pending.current = false; if (current()) setBusy(false); }
  };

  return <div className="page-enter mx-auto max-w-[1500px] p-5 sm:p-8">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><p className="text-sm font-semibold uppercase tracking-[.16em] text-secondary">Your quantum workspace</p>
        <h1 className="glow-text mt-2 text-4xl font-bold sm:text-5xl">Projects</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Build on your ideas. Save circuits, share with collaborators, and keep local copies for offline work.</p></div>
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} aria-label="Import circuit JSON" type="file" accept="application/json,.json" onChange={importJson} className="sr-only" />
        <button disabled={busy || !userId} onClick={() => fileRef.current?.click()} className={actionClass}><Upload className="mr-2 inline size-4" />Import JSON</button>
        <button disabled={busy} onClick={() => void load()} className={actionClass}><RefreshCw className="mr-2 inline size-4" />Refresh projects</button>
      </div>
    </div>
    {!token && <p className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"><Link href="/login?next=/projects" className="font-semibold text-primary underline">Sign in</Link> to save to the cloud and collaborate. Guest projects stay on this device.</p>}
    {!online && <p role="status" className="mt-4 rounded-xl border border-border p-4 text-sm">You’re offline. Save a local copy now and upload it when you reconnect.</p>}
    <section className="glass mt-6 rounded-2xl p-5">
      <form onSubmit={event => { event.preventDefault(); void create(); }} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="text-xs text-muted-foreground">Project name<input maxLength={100} value={name} onChange={event => setName(event.target.value)} className="inspector-input" /></label>
        <button disabled={busy || !userId} className="flex items-center justify-center gap-2 self-end rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Plus className="size-4" />{token && online ? 'Save to cloud' : 'Save on this device'}</button>
      </form>
      {token && online && <button disabled={busy || !userId} onClick={() => void create(true)} className={`${actionClass} mt-3`}>Save a local copy</button>}
      <p className="mt-3 text-xs text-muted-foreground">Current circuit: {circuit.qubits} qubits · {circuit.gates.length} gates. {token && online ? 'Cloud projects are available across your devices.' : 'Local projects are stored in this browser.'}</p>
    </section>
    {error && <div role="alert" className="mt-4 flex items-center gap-3 rounded-xl border border-destructive/40 p-4 text-sm text-destructive"><span>{error}</span><button disabled={busy} onClick={() => void load()} className="ml-auto underline">Reload projects</button></div>}
    {!ready ? <p role="status" className="py-12 text-center text-muted-foreground">Loading projects…</p> : !projects.length ? <div className="empty-state glass mt-8 rounded-2xl p-10"><FolderOpen className="size-8 text-primary" /><h2 className="text-xl font-semibold">No saved projects yet</h2><p>Save your current circuit or import a JSON file to begin.</p></div> :
      <div className="mt-8 grid gap-4 lg:grid-cols-2">{projects.map(project => {
        const canEdit = project.permission !== 'view' && (!project.cloudId || online);
        const owner = !project.cloudId || project.permission === 'owner';
        const max = Math.max(1, ...project.circuit.gates.map(gate => gate.column));
        return <article key={project.id} className="glass min-w-0 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-2 flex items-center gap-2 text-xs text-secondary">{project.cloudId ? <Cloud className="size-3" /> : <FolderOpen className="size-3" />}{project.cloudId ? project.permission === 'owner' ? 'Cloud · Owner' : `Shared · Can ${project.permission}` : 'On this device'}</p><h2 className="break-words text-xl font-semibold">{project.name}</h2><p className="mt-1 text-xs text-muted-foreground">Updated {new Date(project.updatedAt).toLocaleString()}</p></div>
            <button disabled={busy || !canEdit} onClick={() => { const title = window.prompt('Rename project', project.name)?.trim(); if (title) void save(project, { name: title.slice(0, 100) }); }} className={actionClass}>Rename</button></div>
          <div className="mt-5 space-y-5 overflow-x-auto rounded-xl border border-border bg-foreground/5 p-4">{Array.from({ length: project.circuit.qubits }, (_, qubit) => <div key={qubit} className="grid min-w-[260px] grid-cols-[34px_1fr] items-center gap-2"><span className="font-mono text-xs text-muted-foreground">q{qubit}</span><div className="circuit-wire">{project.circuit.gates.filter(gate => gate.qubit === qubit).map(gate => <span key={gate.id} style={{ left: `${5 + (gate.column / max) * 85}%` }} className="mini-gate bg-primary/15 text-primary">{gate.type}</span>)}</div></div>)}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><button onClick={() => open(project)} className="rounded-lg bg-primary p-2 text-xs font-semibold text-primary-foreground">Open</button><button disabled={busy || !canEdit} onClick={() => void save(project, { circuit })} className={actionClass}>Save current circuit</button><button disabled={busy} onClick={() => void duplicate(project)} className={actionClass}>Duplicate</button><button onClick={() => setHistory(project)} className={actionClass}>History</button></div>
          <div className="mt-2 flex flex-wrap gap-2">{(['JSON', 'Qiskit', 'Cirq', 'OpenQASM'] as const).map(format => <button key={format} onClick={() => download(project, format)} className={actionClass}><Download className="mr-1 inline size-3" />{format}</button>)}<button disabled={busy} onClick={() => void duplicate(project, 'Fork')} className={actionClass}>Fork</button></div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">{project.cloudId && owner ? <button disabled={busy || !online} onClick={() => void openSharing(project)} className={actionClass}><Users className="mr-2 inline size-3" />Share & collaborators</button> : !project.cloudId && token ? <button disabled={busy || !online} onClick={() => void upload(project)} className={actionClass}><Cloud className="mr-2 inline size-3" />Upload to cloud</button> : null}{owner && <button disabled={busy || (!!project.cloudId && !online)} onClick={() => { setError(''); setDeleting(project); }} className={`${actionClass} ml-auto text-destructive`}>Delete</button>}</div>
        </article>;
      })}</div>}
    <Dialog open={!!history} onOpenChange={value => { if (!value) setHistory(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogTitle>{history?.name} versions</DialogTitle><DialogDescription>{history?.cloudId ? 'Snapshots from this session. The latest saved circuit is stored in the cloud.' : 'Up to 10 snapshots saved on this device.'}</DialogDescription>{history?.versions.map((version, index) => <div key={`${version.id}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-semibold">Version {history.versions.length - index}</p><p className="text-xs text-muted-foreground">{new Date(version.savedAt).toLocaleString()}</p></div><button className={actionClass} onClick={() => { setCircuit(structuredClone(version.circuit)); setHistory(null); navigate('lab'); }}>Preview in Composer</button></div>)}</DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={value => { if (!value && !busy) setDeleting(null); }}><DialogContent><DialogTitle>Delete {deleting?.name}?</DialogTitle><DialogDescription>{deleting?.cloudId ? 'This removes the cloud project and access for all collaborators.' : 'This removes the project and its saved versions from this device.'} Export a copy first if you want to keep it.</DialogDescription>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><button disabled={busy} onClick={() => setDeleting(null)} className={actionClass}>Cancel</button><button disabled={busy} onClick={() => void remove()} className={`${actionClass} bg-destructive text-white`}>{busy ? 'Deleting…' : 'Delete project'}</button></div></DialogContent></Dialog>
    <Dialog open={!!sharing} onOpenChange={value => { if (!value) { ++shareId.current; setSharing(null); } }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogTitle>Share {sharing?.name}</DialogTitle><DialogDescription>Add an existing Q-SQOOL user by email. View access opens and exports circuits; edit access also saves changes.</DialogDescription>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (sharing?.cloudId) void changeSharing(async () => [...collaborators, await addCollaborator(sharing.cloudId!, inviteEmail.trim(), permission, options)]); }}>
        <label className="block text-xs text-muted-foreground">Collaborator email<input required type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@example.com" className="inspector-input" /></label>
        <label className="block text-xs text-muted-foreground">Permission<select value={permission} onChange={event => setPermission(event.target.value as 'view' | 'edit')} className="inspector-input"><option value="edit">Can edit</option><option value="view">Can view</option></select></label>
        <button disabled={busy || shareLoading || !online || !inviteEmail.trim()} className="w-full rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">{busy ? 'Saving…' : 'Add collaborator'}</button>
      </form>
      {shareError && <div role="alert" className="text-sm text-destructive">{shareError}<button disabled={busy || shareLoading} onClick={() => sharing && void openSharing(sharing)} className="ml-2 underline">Reload collaborators</button></div>}
      <h3 className="mt-2 text-sm font-semibold">Collaborators</h3>{shareLoading ? <p role="status" className="text-sm text-muted-foreground">Loading collaborators…</p> : !collaborators.length ? <p className="text-sm text-muted-foreground">No collaborators yet.</p> : collaborators.map(collaborator => <div key={collaborator.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div className="min-w-0"><p className="break-all text-sm">{collaborator.email}</p><p className="text-xs text-muted-foreground">Can {collaborator.permission}</p></div><button disabled={busy || !online} onClick={() => sharing?.cloudId && void changeSharing(async () => { await removeCollaborator(sharing.cloudId!, collaborator.id, options); return collaborators.filter(item => item.id !== collaborator.id); })} className={`${actionClass} text-destructive`}>Remove</button></div>)}
    </DialogContent></Dialog>
  </div>;
}
