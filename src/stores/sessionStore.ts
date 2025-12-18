// src/stores/sessionStore.ts
import { create } from "zustand";
import { Organization, SpeakerMap, ProcessingSession } from "@/types";
import { getOrganizationById } from "@/lib/api";

// Microsoft user type
interface MsalUser {
  userId: string;
  username: string;
  email?: string;
  roles?: string[];
  oid?: string;
}

// Type for the uploaded file information
interface FileInfo {
  name: string;
  size: number;
  type: string;
}

type OrganizationState = Pick<
  Organization,
  | "id"
  | "name"
  | "remainingMinutes"
  | "remainingTaskGenerations"
  | "monthlyMinutes"
  | "monthlyTaskGenerations"
> | null;

interface SessionState {
  user: MsalUser | null;
  dbUser: { id: string } | null;
  organization: OrganizationState;
  isAdmin: boolean;
  isInitialized: boolean;
  speakerMap: SpeakerMap;
  currentSession: ProcessingSession | null;
  sessionId: string | null;
  file: FileInfo | null;
  speakers: string[];
  processingStatus: string | null;
  downloadLinks: { transcriptUrl?: string; resultsUrl?: string } | null;

  setUser: (user: MsalUser | null) => void;
  setDbUser: (user: { id: string } | null) => void;
  setOrganization: (org: OrganizationState) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setIsInitialized: (isInitialized: boolean) => void;
  setSpeakerMap: (map: SpeakerMap) => void;
  updateSpeakerName: (id: string, name: string) => void;
  clearSpeakerMap: () => void;
  setCurrentSession: (session: ProcessingSession | null) => void;
  updateCurrentSession: (session: ProcessingSession) => void;
  refreshOrganization: () => Promise<void>;
  setSessionId: (id: string | null) => void;
  setFile: (file: FileInfo | null) => void;
  setSpeakers: (speakers: string[]) => void;
  setProcessingStatus: (status: string | null) => void;
  setDownloadLinks: (links: { transcriptUrl?: string; resultsUrl?: string } | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  dbUser: null,
  organization: null,
  isAdmin: false,
  isInitialized: false,
  speakerMap: {},
  currentSession: null,
  sessionId: null,
  file: null,
  processingStatus: null,
  downloadLinks: null,
  speakers: [],

  setUser: (user) => set({ user }),
  setDbUser: (dbUser) => set({ dbUser }),
  setOrganization: (organization) => set({ organization }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setIsInitialized: (isInitialized) => set({ isInitialized }),
  setSpeakerMap: (speakerMap) => set({ speakerMap }),
  updateSpeakerName: (id, name) =>
    set((state) => ({
      speakerMap: { ...state.speakerMap, [id]: name },
    })),
  clearSpeakerMap: () => set({ speakerMap: {} }),
  setCurrentSession: (currentSession) => set({ currentSession }),
  updateCurrentSession: (session) => set({ currentSession: session }),
  setSessionId: (sessionId) => set({ sessionId }),
  setFile: (file) => set({ file }),
  setSpeakers: (speakers) => set({ speakers }),
  setProcessingStatus: (status) => set({ processingStatus: status }),
  setDownloadLinks: (links) => set({ downloadLinks: links }),

  refreshOrganization: async () => {
    const currentOrg = get().organization;
    if (currentOrg?.id) {
      try {
        const org = await getOrganizationById(currentOrg.id);
        if (org) {
          set({
            organization: {
              id: org.id,
              name: org.name,
              remainingMinutes: org.remainingMinutes,
              remainingTaskGenerations: org.remainingTaskGenerations ?? 100,
              monthlyMinutes: org.monthlyMinutes ?? 6000,
              monthlyTaskGenerations: org.monthlyTaskGenerations ?? 100,
            },
          });
        } else {
          set({ organization: null });
        }
      } catch (error) {
        console.error("Failed to refresh organization:", error);
      }
    }
  },
}));
