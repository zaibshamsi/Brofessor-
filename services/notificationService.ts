import { supabase } from './supabaseClient';
import { Notification } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

export const notificationService = {
  // Fetch all notifications for the currently logged-in user
  getNotificationsForUser: async (): Promise<Notification[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_notifications')
      .select(`
        is_read,
        notification:notifications (
          id,
          message,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { referencedTable: 'notifications', ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
    
    // Transform the data to the flat Notification structure
    // Also, filter out any results where the joined 'notification' is null.
    // This can happen if an RLS policy on the 'notifications' table prevents the user from reading the message content.
    return data
      .filter((item: any) => item.notification)
      .map((item: any) => ({
        id: item.notification.id,
        message: item.notification.message,
        created_at: item.notification.created_at,
        is_read: item.is_read,
      }));
  },

  // Mark a specific notification as read for the user
  markNotificationAsRead: async (notificationId: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .match({ user_id: user.id, notification_id: notificationId });

    if (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  // Mark all notifications as read for the current user
  markAllNotificationsAsRead: async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false); // Only update unread ones for efficiency

    if (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },
  
  // Clear a specific notification for the user by deleting the junction table entry
  clearNotification: async (notificationId: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .match({ user_id: user.id, notification_id: notificationId });

    if (error) {
      console.error('Error clearing notification:', error);
      throw error;
    }
  },

  // Clear all notifications for the current user
  clearAllNotifications: async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing all notifications:', error);
      throw error;
    }
  },


  // Send a new notification (admin only)
  sendNotification: async (message: string, senderEmail: string): Promise<void> => {
    // This function has been refactored to use a single, atomic RPC call ('send_notification_to_all_users').
    // This resolves RLS issues, race conditions with triggers, and ensures the entire operation is transactional.
    const { error } = await supabase.rpc('send_notification_to_all_users', {
      message_text: message,
      sender_email_text: senderEmail,
    });

    if (error) {
      console.error('Error sending notification via RPC:', error);
      throw error;
    }
    
    // After the RPC call is successful, invoke the Edge Function to send emails.
    supabase.functions.invoke('send-notification-emails', {
        body: { message },
    }).then(({ error: functionError }) => {
        if (functionError) {
            // Log the error but don't throw, as the database operations were successful.
            console.error('Error invoking send-notification-emails Edge Function:', functionError);
        }
    });
  },

  // Subscribe to real-time updates for new notifications for the current user
  subscribeToNotifications: async (callback: (payload: any) => void): Promise<RealtimeChannel> => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // If there's no user, we can't subscribe. Return a placeholder subscription
    // that can be unsubscribed from without error.
    if (!user) {
        console.warn("No user found, cannot subscribe to notifications.");
        const dummyChannel = supabase.channel('dummy_notifications');
        dummyChannel.subscribe(); // It's important to call subscribe() so that removeChannel() works.
        return dummyChannel;
    }

    const channel = supabase
        .channel(`user_notifications:${user.id}`) // Use a user-specific channel name for robustness
        .on(
            'postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'user_notifications',
                filter: `user_id=eq.${user.id}` // Filter to only get events for the current user
            }, 
            callback
        )
        .subscribe();
      
    return channel;
  },

  // Unsubscribe from the notification channel
  unsubscribeFromNotifications: async (channel: RealtimeChannel) => {
    await supabase.removeChannel(channel);
  },
};