import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { parseChatScript, generateInitialsAvatar } from '../parser/parseChatScript';
import { saveMedia, resolveObjectUrl } from '../media/mediaStore';
import { PRESETS } from '../templates/presets';
import { isAiPlatform } from '../parser/types';
import type { ChatProject, Message, Participant, Reaction } from '../parser/types';

const STORAGE_KEY = 'ecm:v1:project';

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

interface EditorState {
  project: ChatProject;
  scriptInput: string;
  warnings: string[];
  // Actions
  setScriptInput: (s: string) => void;
  parseAndLoad: (script: string, selfSpeakerName?: string) => void;
  loadPreset: (id: 'private' | 'group') => void;
  setPlatform: (p: ChatProject['platform']) => void;
  setTheme: (t: ChatProject['theme']) => void;
  setDeviceOS: (os: ChatProject['deviceOS']) => void;
  setTitle: (title: string) => void;
  setSubtitle: (sub: string) => void;
  setSelfParticipant: (participantId: string) => void;
  updateParticipant: (id: string, patch: Partial<Omit<Participant, 'id'>>) => void;
  setParticipantAvatar: (participantId: string, file: File) => Promise<void>;
  setGroupAvatar: (file: File) => Promise<void>;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  addTextMessage: (afterId: string | null, participantId?: string, replyToId?: string) => void;
  addImageMessage: (afterId: string | null, file: File, participantId?: string) => Promise<void>;
  addDateMessage: (afterId: string | null, label?: string) => void;
  addSystemMessage: (afterId: string | null, text?: string) => void;
  addCallMessage: (afterId: string | null, participantId?: string, isVoice?: boolean, duration?: string, status?: 'missed' | 'completed' | 'declined') => void;
  addVoiceNoteMessage: (afterId: string | null, participantId?: string, duration?: string) => void;
  deleteMessage: (id: string) => void;
  setReaction: (msgId: string, emoji: string) => void;
  clearReaction: (msgId: string) => void;
  setExportConsent: (v: boolean) => void;
  resolveImageUrls: () => Promise<void>;
  reset: () => void;
  hydrateFromStorage: () => void;
  saveToStorage: () => void;
}

function insertAfter(messages: Message[], afterId: string | null, newMsg: Message): Message[] {
  if (!afterId) return [...messages, newMsg];
  const idx = messages.findIndex((m) => m.id === afterId);
  if (idx === -1) return [...messages, newMsg];
  return [...messages.slice(0, idx + 1), newMsg, ...messages.slice(idx + 1)];
}

function formatDateChip(date = new Date()): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function defaultSubtitleForPlatform(platform: ChatProject['platform'], isGroup: boolean, participantCount: number): string {
  // AI platforms use the subtitle as the model label
  if (platform === 'chatgpt') return '';
  if (platform === 'claude') return 'Opus 4.8';
  if (platform === 'gemini') return 'Flash';
  if (isGroup) {
    if (platform === 'slack') return `${participantCount} members • 4 tabs`;
    if (platform === 'telegram') return `${participantCount} members, 2 online`;
    if (platform === 'discord') return `${participantCount} Members`;
    return `${participantCount} members`;
  }
  if (platform === 'instagram') return 'Active today';
  if (platform === 'messenger') return 'Active now';
  if (platform === 'slack') return '3 tabs';
  if (platform === 'telegram') return 'last seen recently';
  if (platform === 'discord') return 'Active now';
  return 'online';
}

/**
 * AI chats always open with the user's prompt: make the sender of the
 * first chat message the self participant so it renders on the user side.
 */
function alignFirstMessageToSelf(p: ChatProject): ChatProject {
  if (!isAiPlatform(p.platform)) return p;
  const firstMsg = p.messages.find((m) => m.kind === 'text' || m.kind === 'image');
  if (!firstMsg || !('participantId' in firstMsg)) return p;
  const firstPid = firstMsg.participantId;
  if (p.participants.find((pp) => pp.id === firstPid)?.isSelf) return p;
  return {
    ...p,
    participants: p.participants.map((pp) => ({ ...pp, isSelf: pp.id === firstPid })),
  };
}

const defaultProject = (): ChatProject => ({
  ...PRESETS.private,
  id: nanoid(),
  exportConsentAccepted: false,
});

export const useEditorStore = create<EditorState>((set, get) => {
  const persist = debounce(() => {
    const { project } = get();
    try {
      // Don't persist objectUrls (they are temporary)
      const clean = {
        ...project,
        messages: project.messages.map((m) =>
          m.kind === 'image' ? { ...m, objectUrl: undefined } : m
        ),
        participants: project.participants.map((p) => ({ ...p })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch { /* ignore quota errors */ }
  }, 500) as () => void;

  const update = (updater: (p: ChatProject) => ChatProject) => {
    set((s) => ({ project: updater(s.project) }));
    persist();
  };

  return {
    project: defaultProject(),
    scriptInput: '',
    warnings: [],

    setScriptInput: (s) => set({ scriptInput: s }),

    parseAndLoad: (script, selfSpeakerName) => {
      const result = parseChatScript(script, selfSpeakerName);
      if (result.participants.length === 0) return;
      const isGroup = !isAiPlatform(get().project.platform)
        && result.participants.filter((x) => !x.isSelf).length > 1;
      const otherParticipant = result.participants.find((x) => !x.isSelf);
      const groupCreatedMessage = result.messages.find((m) => (
        m.kind === 'system' && /created group/i.test(m.text)
      ));
      const groupTitle = groupCreatedMessage?.kind === 'system'
        ? groupCreatedMessage.text.match(/created group\s+["“](.+?)["”]/i)?.[1]
        : undefined;
      update((p) => alignFirstMessageToSelf({
        ...p,
        id: nanoid(),
        participants: result.participants,
        messages: result.messages,
        isGroup,
        title: isGroup ? groupTitle ?? 'Group Chat' : otherParticipant?.name ?? result.participants[0]?.name ?? p.title,
        subtitle: defaultSubtitleForPlatform(p.platform, isGroup, result.participants.length),
      }));
      set({ warnings: result.warnings });
    },

    loadPreset: (id) => {
      const preset = PRESETS[id];
      if (!preset) return;
      update(() => ({ ...preset, id: nanoid(), exportConsentAccepted: false }));
      set({ scriptInput: '', warnings: [] });
    },

    setPlatform: (platform) => update((p) => {
      // AI assistant platforms are always 1:1 — group chat is disabled
      const isGroup = isAiPlatform(platform) ? false : p.isGroup;
      return alignFirstMessageToSelf({
        ...p,
        platform,
        isGroup,
        subtitle: defaultSubtitleForPlatform(platform, isGroup, p.participants.length),
      });
    }),
    setTheme: (theme) => update((p) => ({ ...p, theme })),
    setDeviceOS: (deviceOS) => update((p) => ({ ...p, deviceOS })),
    setTitle: (title) => update((p) => ({ ...p, title })),
    setSubtitle: (subtitle) => update((p) => ({ ...p, subtitle })),

    setSelfParticipant: (participantId) => {
      update((p) => ({
        ...p,
        participants: p.participants.map((pp) => ({
          ...pp,
          isSelf: pp.id === participantId,
          avatarUrl: generateInitialsAvatar(pp.name, pp.id === participantId),
        })),
      }));
    },

    updateParticipant: (id, patch) => {
      update((p) => ({
        ...p,
        participants: p.participants.map((pp) =>
          pp.id === id ? { ...pp, ...patch } : pp
        ),
      }));
    },

    setParticipantAvatar: async (participantId, file) => {
      const item = await saveMedia(file);
      const objectUrl = URL.createObjectURL(item.blob);
      update((p) => ({
        ...p,
        participants: p.participants.map((pp) =>
          pp.id === participantId
            ? { ...pp, avatarMediaId: item.id, avatarUrl: objectUrl }
            : pp
        ),
      }));
    },

    setGroupAvatar: async (file) => {
      const item = await saveMedia(file);
      const objectUrl = URL.createObjectURL(item.blob);
      update((p) => ({ ...p, groupAvatarMediaId: item.id, _groupAvatarUrl: objectUrl } as ChatProject & { _groupAvatarUrl: string }));
    },

    updateMessage: (id, patch) => {
      update((p) => ({
        ...p,
        messages: p.messages.map((m) => (m.id === id ? { ...m, ...patch } as Message : m)),
      }));
    },

    addTextMessage: (afterId, participantId, replyToId) => {
      const { project } = get();
      
      let pid = participantId;
      if (!pid && afterId) {
        const parentMsg = project.messages.find((m) => m.id === afterId);
        if (parentMsg && 'participantId' in parentMsg) {
          pid = parentMsg.participantId;
        }
      }
      if (!pid) {
        // AI chats always start with the user's message
        const startWithSelf = isAiPlatform(project.platform) && project.messages.length === 0;
        pid = startWithSelf
          ? project.participants.find((pp) => pp.isSelf)?.id ?? project.participants[0]?.id
          : project.participants.find((pp) => !pp.isSelf)?.id ?? project.participants[0]?.id;
      }
      if (!pid) return;

      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const timeStr = `${hours}:${minutes} ${ampm}`;

      const msg: Message = { id: nanoid(), kind: 'text', participantId: pid, text: 'New message', time: timeStr, replyToId } as any;
      update((p) => ({ ...p, messages: insertAfter(p.messages, afterId, msg) }));
    },

    addImageMessage: async (afterId, file, participantId) => {
      const { project } = get();
      
      let pid = participantId;
      if (!pid && afterId) {
        const parentMsg = project.messages.find((m) => m.id === afterId);
        if (parentMsg && 'participantId' in parentMsg) {
          pid = parentMsg.participantId;
        }
      }
      if (!pid) {
        pid = project.participants.find((pp) => !pp.isSelf)?.id ?? project.participants[0]?.id;
      }
      if (!pid) return;
      
      const item = await saveMedia(file);
      const objectUrl = URL.createObjectURL(item.blob);
      
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const timeStr = `${hours}:${minutes} ${ampm}`;

      const msg: Message = {
        id: nanoid(),
        kind: 'image',
        participantId: pid,
        mediaId: item.id,
        objectUrl,
        width: item.width,
        height: item.height,
        time: timeStr,
      };
      update((p) => ({ ...p, messages: insertAfter(p.messages, afterId, msg) }));
    },

    addDateMessage: (afterId, label = formatDateChip()) => {
      const msg: Message = { id: nanoid(), kind: 'date', label };
      update((p) => ({ ...p, messages: insertAfter(p.messages, afterId, msg) }));
    },

    addSystemMessage: (afterId, text = 'Someone joined') => {
      const msg: Message = { id: nanoid(), kind: 'system', text };
      update((p) => ({ ...p, messages: insertAfter(p.messages, afterId, msg) }));
    },

    addCallMessage: (afterId, participantId, isVoice = true, duration = '1 min', status = 'completed') => {
      const { project } = get();
      
      let pid = participantId;
      if (!pid && afterId) {
        const parentMsg = project.messages.find((m) => m.id === afterId);
        if (parentMsg && 'participantId' in parentMsg) {
          pid = parentMsg.participantId;
        }
      }
      if (!pid) {
        pid = project.participants.find((pp) => !pp.isSelf)?.id ?? project.participants[0]?.id;
      }
      if (!pid) return;
      
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const timeStr = `${hours}:${minutes} ${ampm}`;

      const msg: Message = {
        id: nanoid(),
        kind: 'call',
        participantId: pid,
        isVoice,
        duration: status === 'completed' ? duration : undefined,
        status,
        time: timeStr,
      };
      update((p) => ({ ...p, messages: insertAfter(p.messages, afterId, msg) }));
    },

    addVoiceNoteMessage: (afterId, participantId, duration = '0:07') => {
      const { project } = get();

      let pid = participantId;
      if (!pid && afterId) {
        const parentMsg = project.messages.find((m) => m.id === afterId);
        if (parentMsg && 'participantId' in parentMsg) {
          pid = parentMsg.participantId;
        }
      }
      if (!pid) {
        pid = project.participants.find((pp) => !pp.isSelf)?.id ?? project.participants[0]?.id;
      }
      if (!pid) return;

      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const timeStr = `${hours}:${minutes} ${ampm}`;

      const msg: Message = {
        id: nanoid(),
        kind: 'voice',
        participantId: pid,
        duration,
        time: timeStr,
      };
      update((p) => ({ ...p, messages: insertAfter(p.messages, afterId, msg) }));
    },

    deleteMessage: (id) => {
      update((p) => ({ ...p, messages: p.messages.filter((m) => m.id !== id) }));
    },

    setReaction: (msgId, emoji) => {
      update((p) => ({
        ...p,
        messages: p.messages.map((m) =>
          m.id === msgId && (m.kind === 'text' || m.kind === 'image')
            ? { ...m, reaction: { emoji } as Reaction }
            : m
        ),
      }));
    },

    clearReaction: (msgId) => {
      update((p) => ({
        ...p,
        messages: p.messages.map((m) =>
          m.id === msgId && (m.kind === 'text' || m.kind === 'image')
            ? { ...m, reaction: undefined }
            : m
        ),
      }));
    },

    setExportConsent: (v) => update((p) => ({ ...p, exportConsentAccepted: v })),

    resolveImageUrls: async () => {
      const { project } = get();
      const resolved = await Promise.all(
        project.messages.map(async (m) => {
          if (m.kind === 'image' && m.mediaId && !m.objectUrl) {
            const url = await resolveObjectUrl(m.mediaId);
            return url ? { ...m, objectUrl: url } : m;
          }
          return m;
        })
      );
      const resolvedParticipants = await Promise.all(
        project.participants.map(async (pp) => {
          if (pp.avatarMediaId && !pp.avatarUrl?.startsWith('blob:')) {
            const url = await resolveObjectUrl(pp.avatarMediaId);
            return url ? { ...pp, avatarUrl: url } : pp;
          }
          return pp;
        })
      );
      set((s) => ({
        project: { ...s.project, messages: resolved as Message[], participants: resolvedParticipants },
      }));
    },

    reset: () => {
      set({ project: defaultProject(), scriptInput: '', warnings: [] });
      persist();
    },

    hydrateFromStorage: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as ChatProject;
        set({ project: { ...saved, exportConsentAccepted: false } });
        get().resolveImageUrls();
      } catch { /* ignore */ }
    },

    saveToStorage: persist,
  };
});
