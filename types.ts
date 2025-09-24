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
}

export interface ProcessedFileResult {
  fileInfo: KnowledgeFile;
  content: string | null;
}

export type UserRole = 'admin' | 'user';

export interface User {
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
}
