import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 1. Verificar usuario solicitante
        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Verificar Rol del solicitante (Edge Function Service Role para leer tabla profiles de ser necesario, 
        // pero aquí usamos cliente normal y RPC o consulta directa si las políticas lo permiten.
        // Para simplificar y asegurar seguridad, usamos el Service Role para chequear el rol real en la DB)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: requesterProfile } = await supabaseAdmin
            .from('employee_profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!requesterProfile || (requesterProfile.role !== 'admin' && requesterProfile.role !== 'super_admin')) {
            return new Response(
                JSON.stringify({ error: 'Forbidden: Insufficient permissions' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { action, userId, newPassword } = await req.json()

        if (action === 'reset_password') {
            if (!userId || !newPassword) {
                return new Response(
                    JSON.stringify({ error: 'Missing userId or newPassword' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // 3. Ejecutar cambio de contraseña con Service Role
            const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                { password: newPassword }
            )

            if (error) throw error

            return new Response(
                JSON.stringify({ success: true, message: 'Password updated successfully' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ error: 'Invalid action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
