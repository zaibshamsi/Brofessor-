import { supabase } from './supabaseClient';
import { KnowledgeFile } from '../types';

interface StoredKnowledgeBase {
    content: string;
    files: KnowledgeFile[];
}

const KB_ROW_ID = 1; // We use a single row for the global knowledge base

export const knowledgeBaseService = {
    getKnowledgeBase: async (): Promise<StoredKnowledgeBase> => {
        const { data, error } = await supabase
            .from('knowledge_base')
            .select('content, files')
            .eq('id', KB_ROW_ID)
            .single();

        if (error) {
            // If the row doesn't exist yet, return an empty state.
            if (error.code === 'PGRST116') { 
                return { content: '', files: [] };
            }
            console.error("Error fetching knowledge base:", error);
            throw error;
        }
        
        return data ? { content: data.content || '', files: data.files || [] } : { content: '', files: [] };
    },

    setKnowledgeBase: async (content: string, files: KnowledgeFile[]): Promise<void> => {
        const { error } = await supabase
            .from('knowledge_base')
            .upsert({ 
                id: KB_ROW_ID, 
                content, 
                files,
                updated_at: new Date().toISOString() 
            });

        if (error) {
            console.error("Error saving knowledge base:", error);
            throw error;
        }
    }
};