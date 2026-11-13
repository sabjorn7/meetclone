export async function readVkResponse(response) {
    if (!response.ok) throw new Error('VK workflow request failed');
    let result;
    try { result = await response.json(); } catch { throw new Error('Invalid VK workflow response'); }
    if (!result || typeof result !== 'object' || Array.isArray(result)
        || (result.error && result.error !== 'null')
        || typeof result.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)
        || typeof result.otp !== 'string' || !/^\d{6,10}$/.test(result.otp)) {
        throw new Error('VK workflow did not return login credentials');
    }
    return { email: result.email, otp: result.otp };
}
