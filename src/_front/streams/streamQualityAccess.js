// Global feature availability only; ownership and capacity remain server-enforced.
export async function fullHdAvailable(supabase) {
    try {
        const { data, error } = await supabase.rpc('stream_video_quality_capabilities');
        return !error && data?.version === 1 && data.full_hd_enabled === true;
    } catch { return false; }
}
