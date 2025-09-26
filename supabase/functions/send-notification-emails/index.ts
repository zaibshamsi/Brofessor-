// File: supabase/functions/send-notification-emails/index.ts
// This self-contained version uses the Resend API and can be deployed by pasting into the Supabase web editor.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// The endpoint for the Resend API
const RESEND_API_URL = 'https://api.resend.com/emails';

serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    // 1. AUTHENTICATION: Verify the user making the request is an admin
    // ----------------------------------------------------------------
    const userSupabaseClient = createClient(
      // Deno.env.get() is the standard way to access secrets in Supabase Edge Functions
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: roleData, error: roleError } = await userSupabaseClient.rpc('get_my_role');
    if (roleError || roleData !== 'admin') {
      console.warn("Unauthorized attempt to send notifications. Role:", roleData, "Error:", roleError);
      return new Response('Forbidden: User is not an admin', { status: 403 });
    }

    // 2. FETCH DATA: Get the notification message and all user emails
    // ----------------------------------------------------------------
    const supabaseAdmin = createClient(
      (Deno as any).env.get('SUPABASE_URL')!,
      (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { message } = await req.json();
    if (!message) {
      return new Response('Bad Request: Missing message in request body', { status: 400 })
    }
    
    const { data: usersData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) {
      console.error('Database error fetching users:', userError.message);
      return new Response(`Internal Server Error: ${userError.message}`, { status: 500 });
    }

    const users = usersData.users;
    if (!users || users.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'No users to notify.' }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    // 3. GET SECRETS: Load the Resend API key and the "from" email address
    // ----------------------------------------------------------------
    const resendApiKey = (Deno as any).env.get('RESEND_API_KEY');
    const fromEmail = (Deno as any).env.get('NOTIFICATION_FROM_EMAIL');

    if (!resendApiKey || !fromEmail) {
        console.error('Email service is not configured. Missing RESEND_API_KEY or NOTIFICATION_FROM_EMAIL secrets.');
        return new Response('Internal Server Error: Email service is not configured.', { status: 500 });
    }
    
    // 4. SEND EMAILS: Loop through users and send an email to each one
    // ----------------------------------------------------------------
    for (const user of users) {
      if (user.email) {
        // Use the built-in `fetch` to call the Resend API.
        // This has no external dependencies and works in the Supabase editor.
         fetch(RESEND_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
                from: fromEmail, // e.g., 'Brofessor <onboarding@resend.dev>'
                to: [user.email],
                subject: 'New Notification from Brofessor',
                html: `
                  <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #4338ca;">Hello!</h2>
                    <p>You have a new notification:</p>
                    <div style="background-color: #f3f4f6; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0;">
                      <p style="margin: 0; white-space: pre-wrap;">${message}</p>
                    </div>
                    <p>Please log in to the application to see more details.</p>
                    <br/>
                    <p>Best regards,</p>
                    <p><strong>The Brofessor Team</strong></p>
                  </div>
                `,
            }),
        }).catch(e => console.error(`Failed to send email to ${user.email}:`, e.message));
      }
    }

    // 5. RESPOND: Return a success message
    // ----------------------------------------------------------------
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    // Catch-all for any unexpected errors during the process
    console.error('Unexpected error in Edge Function:', error.message)
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 })
  }
})