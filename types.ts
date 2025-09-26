export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

export type FileStatus = 'processed' | 'unsupported' | 'processing' | 'error';

export interface KnowledgeFile {
  name: string;
  type: string;
  status: FileStatus;
  storagePath?: string; // Path to the file in Supabase Storage
}

export interface ProcessedFileResult {
  fileInfo: KnowledgeFile;
  content: string | null;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthContextType {
  currentUser: User | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<any>;
  logout: () => void;
}

export interface KnowledgeBaseContextType {
    knowledgeContext: string;
    knowledgeFiles: KnowledgeFile[];
    updateKnowledgeBase: (contentToAppend: string, filesToAppend: KnowledgeFile[]) => Promise<void>;
    deleteKnowledgeFile: (fileName: string) => Promise<void>;
    isLoading: boolean;
    // Notification-related properties
    notifications: Notification[];
    isLoadingNotifications: boolean;
    unreadNotificationsCount: number;
    markNotificationAsRead: (notificationId: string) => Promise<void>;
    markAllNotificationsAsRead: () => Promise<void>;
    clearNotification: (notificationId: string) => Promise<void>;
    clearAllNotifications: () => Promise<void>;
    sendNotification: (message: string) => Promise<void>;
    // Timetable-related properties for central state management
    timetables: Timetable[];
    isTimetablesLoading: boolean;
    addTimetable: (file: File, department: string, year: string) => Promise<void>;
    deleteTimetable: (timetableId: number, storagePath: string) => Promise<void>;
}

// Fix: Add Notification interface
export interface Notification {
  id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

export interface Timetable {
  id: number;
  department: string;
  year: string;
  file_name: string;
  storage_path: string;
  content: string; // Extracted text for the AI
  created_at: string;
}
