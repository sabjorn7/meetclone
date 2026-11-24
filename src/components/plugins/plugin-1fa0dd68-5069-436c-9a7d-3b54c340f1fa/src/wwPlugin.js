import { instrumentAuth } from '@/_front/chrome/sessionDiagnostic.js';
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { getCurrentSupabaseSettings, resolveRuntimeProjectUrl } from './helpers/environmentConfig';
import { guardedTimeout } from '@/_front/chrome/freezeGuard.js';

import { authRecoveryOptions, watchAuthRecovery } from '@/_front/chrome/authRecovery.js';

function authBanner(kind) {
    window.__mgAuthBanner = kind;
    window.dispatchEvent(new CustomEvent('mg-auth-banner', { detail: kind }));
}
function validSession(session) {
    return !!session?.access_token && !!session.user?.id && Number(session.expires_at) * 1000 > Date.now();
}

function writeSessionCookie(name, value, maxAge) {
    const path = wwLib.manager ? '/' + wwLib.wwWebsiteData.getInfo().id : '/';
    for (const domain of [window.location.hostname, '.' + window.location.hostname]) {
        document.cookie = `${name}=${encodeURIComponent(value)}; path=${path}; domain=${domain}; max-age=${maxAge}; secure; samesite=Lax`;
    }
}
function clearSessionCookies() {
    writeSessionCookie('mg-auth-v2-access', '', 0);
    writeSessionCookie('mg-auth-v2-refresh', '', 0);
}

const maskForLog = value => {
    if (!value) return null;
    const str = String(value);
    if (str.length <= 8) return str;
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
};

export default {
    privateInstance: null,
    publicInstance: null,
    /*=============================================m_ÔÔ_m=============================================\
        Plugin API
    \================================================================================================*/
    async _onLoad(settings) {
        const config = getCurrentSupabaseSettings('supabaseAuth');

        /* wwFront:start */
        await this.load(config.projectUrl, config.publicApiKey);
        /* wwFront:end */
    },
    async _initAuth() {
        let timer;
        try {
            await Promise.race([
                this.refreshAuthUser(),
                new Promise(resolve => { timer = guardedTimeout(() => { this.markAuthPending(); resolve(false); }, 3000, { label: 'auth_preflight_timeout' }); }),
            ]);
        } finally { timer?.clear(); }
    },
    _getUser() {
        return this.isAuthenticated && validSession({ ...this.user?._session, user: this.user }) ? this.user : null;
    },
    // Both names are used by the existing WeWeb auth service.
    _isAuthenticated() { return this._getIsAuthenticated(); },
    _getIsAuthenticated() { return !!this._getUser(); },
    _getUserRoles() {
        return this._getUser()?.roles || [];
    },
    _matchRoles(roles) {
        return roles.every(role => this._getUser()?.roles?.map(({ id }) => id).includes(role));
    },
    /*=============================================m_ÔÔ_m=============================================\
        Auth API
    \================================================================================================*/
    /*=============================================m_ÔÔ_m=============================================\
        Supabase Auth API
    \================================================================================================*/
    async load(projectUrl, publicApiKey, privateApiKey = null) {
        try {
            const config = getCurrentSupabaseSettings('supabaseAuth');
            const runtimeProjectUrl = resolveRuntimeProjectUrl(config) || projectUrl;
            const effectivePublicKey = config?.publicApiKey || publicApiKey;
            const effectivePrivateKey = config?.privateApiKey || privateApiKey;
            if (!runtimeProjectUrl || !effectivePublicKey) return;


            this._authSubscription?.unsubscribe();
            this._stopRecovery?.();
            this.publicInstance = createClient(runtimeProjectUrl, effectivePublicKey, authRecoveryOptions(runtimeProjectUrl, `${wwLib.wwWebsiteData.getInfo().id}:auth-v2`));
            instrumentAuth(this.publicInstance);

            // The same public instance must be shared between supabase and supabase auth
            if (wwLib.wwPlugins.supabase) wwLib.wwPlugins.supabase.syncInstance();
            if (!this.privateInstance && !this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
            this._authEpoch = 0;
            this._lastAuthSession = undefined;
            this._authSubscription = this.publicInstance.auth.onAuthStateChange((event, session) => {
                const epoch = ++this._authEpoch;
                // An event is an invalidation, not proof of the current identity.
                this._lastAuthSession = undefined;
                if (event === 'SIGNED_OUT' || event === 'USER_DELETED' ||
                    !validSession(session) || this.user?.id !== session.user.id) this.clearAuthView();
                clearTimeout(this._authEventTimer);
                this._authEventTimer = setTimeout(() => {
                    if (this._authEpoch === epoch) this.refreshAuthUser().catch(() => this.markAuthPending());
                }, 0);
            }).data.subscription;
            this._stopRecovery = watchAuthRecovery(this.publicInstance, () => this.markAuthPending(), () => this.refreshAuthUser());
        } catch (err) {
            this.publicInstance = null;
            this.privateInstance = null;
            this.doc = null;
            wwLib.wwLog.error(err);
        }
    },
    async signUp({ type = 'email', email, phone, channel, password, metadata, redirectPage, emailRedirectTo: explicitEmailRedirectTo, captchaToken }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        try {
            const user_metadata = Array.isArray(metadata)
                ? metadata.reduce((obj, item) => ({ ...obj, [item.key]: item.value }), {})
                : metadata;
            const emailRedirectTo =
                explicitEmailRedirectTo || (redirectPage &&
                (wwLib.manager
                    ? `${window.location.origin}/${redirectPage}`
                    : `${window.location.origin}${wwLib.wwPageHelper.getPagePath(redirectPage)}`));

            const { data, error } = await this.publicInstance.auth.signUp(
                type === 'email'
                    ? { email, password, options: { captchaToken, data: user_metadata, emailRedirectTo } }
                    : { phone, password, options: { channel, captchaToken, data: user_metadata, emailRedirectTo } }
            );
            if (error) throw new Error(error.message, { cause: error });
            return data;
        } catch (err) {
            wwLib.wwLog.error(err);
            throw err;
        }
    },

    async signInEmail({ email, password, captchaToken }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        if (!email || !password) throw new Error('Email and Password are required.');
        try {
            const { data, error } = await this.publicInstance.auth.signInWithPassword({
                email,
                password,
                options: { captchaToken },
            });
            if (error) throw new Error(error.message, { cause: error });
            return await this.refreshAuthUser(data?.session);
        } catch (err) {
            wwLib.wwLog.error(err);
            throw err;
        }
    },
    async signInPhone({ phone, password, captchaToken }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        if (!phone || !password) throw new Error('Phone and Password are required.');
        try {
            const { data, error } = await this.publicInstance.auth.signInWithPassword({
                phone,
                password,
                options: { captchaToken },
            });
            if (error) throw new Error(error.message, { cause: error });
            return await this.refreshAuthUser(data?.session);
        } catch (err) {
            wwLib.wwLog.error(err);
            throw err;
        }
    },
    async signInOIDC({ token, provider, access_token, nonce, captchaToken }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        if (!token || !provider) throw new Error('Token and Provider are required.');
        try {
            const { data, error } = await this.publicInstance.auth.signInWithIdToken({
                token,
                provider,
                access_token,
                nonce,
                options: { captchaToken },
            });
            if (error) throw new Error(error.message, { cause: error });
            return await this.refreshAuthUser(data?.session);
        } catch (err) {
            wwLib.wwLog.error(err);
            throw err;
        }
    },
    async signInMagicLink({ email, redirectPage, captchaToken }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        if (!email) throw new Error('Email is required.');
        const emailRedirectTo = wwLib.manager
            ? `${window.location.origin}/${redirectPage}`
            : `${window.location.origin}${wwLib.wwPageHelper.getPagePath(redirectPage)}`;

        const { data, error } = await this.publicInstance.auth.signInWithOtp({
            email,
            options: { emailRedirectTo, captchaToken },
        });
        if (error) throw new Error(error.message, { cause: error });
        return data;
    },
    async signInOTP({ type = 'phone', email, phone, channel, captchaToken, shouldCreateUser = true }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        if (type === 'email' && !email) throw new Error('Email is required.');
        else if (type === 'phone' && !phone) throw new Error('Phone is required.');

        try {
            const { data, error } = await this.publicInstance.auth.signInWithOtp(
                type === 'email'
                    ? { email, options: { captchaToken, shouldCreateUser } }
                    : { phone, options: { channel, captchaToken, shouldCreateUser } }
            );
            if (error) throw new Error(error.message, { cause: error });
            return data?.session ? await this.refreshAuthUser(data?.session) : data;
        } catch (err) {
            wwLib.wwLog.error(err);
            throw err;
        }
    },
    async signInProvider({ provider, redirectPage, queryParams, scopes, skipBrowserRedirect }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        if (!provider) throw new Error('Provider is required.');
        const redirectTo = wwLib.manager
            ? `${window.location.origin}/${redirectPage}`
            : `${window.location.origin}${wwLib.wwPageHelper.getPagePath(redirectPage)}`;
        try {
            const { data, error } = await this.publicInstance.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo,
                    scopes,
                    queryParams: Array.isArray(queryParams)
                        ? queryParams.reduce((result, param) => ({ ...result, [param.key]: param.value }))
                        : queryParams,
                    skipBrowserRedirect,
                },
            });
            if (error) throw new Error(error.message, { cause: error });
            return data;
        } catch (err) {
            wwLib.wwLog.error(err);
            throw err;
        }
    },
    async signInSSO({ domain, providerId }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        if (!domain && !providerId) throw new Error('Domain or ProviderId is required.');

        try {
            const { data, error } = await this.publicInstance.auth.signInWithSSO(domain ? { domain } : { providerId });

            if (error) throw new Error(error.message, { cause: error });
            if (data?.url) {
                // redirect the user to the identity provider's authentication flow
                window.location.href = data.url;
            }
        } catch (err) {
            wwLib.wwLog.error(err);
            throw err;
        }
    },
    async verifyOTP({ type, email, phone, token, tokenHash }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        const isEmail = ['email', 'recovery', 'invite', 'email_change'].includes(type);
        const isPhone = ['sms', 'phone_change'].includes(type);
        if (isEmail && !email) throw new Error('Email is required.');
        else if (isPhone && !phone) throw new Error('Phone is required.');
        try {
            const {
                data: { session },
                error,
            } = await this.publicInstance.auth.verifyOtp({
                type,
                ...(isEmail ? { email } : null),
                ...(isPhone ? { phone } : null),
                ...(token ? { token } : null),
                ...(tokenHash ? { token_hash: tokenHash } : null),
            });
            if (error) throw new Error(error.message, { cause: error });
            return await this.refreshAuthUser(session);
        } catch (err) {
            wwLib.wwLog.error(err);
            throw err;
        }
    },

    async resendOTP({ type, email, phone, redirectPage }) {
        const isEmail = ['signup', 'email_change'].includes(type);
        const isPhone = ['sms', 'phone_change'].includes(type);
        if (isEmail && !email) throw new Error('Email is required.');
        else if (isPhone && !phone) throw new Error('Phone is required.');
        const redirectTo = wwLib.manager
            ? `${window.location.origin}/${redirectPage}`
            : `${window.location.origin}${wwLib.wwPageHelper.getPagePath(redirectPage)}`;
        const { data, error } = await this.publicInstance.auth.resend({
            type,
            ...(isEmail ? { email } : null),
            ...(isPhone ? { phone } : null),
            options: {
                emailRedirectTo: redirectTo,
            },
        });
        if (error) throw new Error(error.message, { cause: error });
        return data;
    },

    signOut() {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');

        this._authEpoch = (this._authEpoch || 0) + 1;
        this._authRequest = (this._authRequest || 0) + 1;
        this._lastAuthSession = null;
        this.user = null;
        this.isAuthenticated = false;
        clearSessionCookies();
        this.publicInstance.auth.signOut();
    },
    // Ensure Retro compatibility for the workflow action fetchUser
    fetchUser() {
        return this.refreshAuthUser();
    },
    clearAuthView() {
        this.user = null;
        this.isAuthenticated = false;
    },
    markAuthPending() {
        this.clearAuthView();
        window.__mgGuestAuth = true;
        authBanner('offline');
    },
    async refreshAuthUser() {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        const request = this._authRequest = (this._authRequest || 0) + 1;
        const started = this._authEpoch || 0;
        let result;
        try { result = await this.publicInstance.auth.getSession(); }
        catch { if (request === this._authRequest) this.markAuthPending(); return false; }
        const session = result.data?.session;
        if (started !== (this._authEpoch || 0) || request !== this._authRequest) return false;
        if (result.error) {
            if (isAuthRetryableFetchError(result.error)) this.markAuthPending();
            else { this.clearAuthView(); clearSessionCookies(); window.__mgGuestAuth = false; authBanner('reauth'); }
            return false;
        }
        if (!validSession(session)) {
            this.clearAuthView();
            if (!session) { clearSessionCookies(); window.__mgGuestAuth = false; authBanner(''); }
            return false;
        }
        const epoch = this._authEpoch || 0;
        let roles;
        try { roles = await this.getUserRoles(session.user.id); }
        catch { if (request === this._authRequest) this.markAuthPending(); return false; }
        if (request !== this._authRequest || epoch !== (this._authEpoch || 0) || !validSession(session)) return false;
        const currentUser = wwLib.wwVariable.getValue(`${this.id}-user`);
        const user = { ...session.user, roles, _session: {
            access_token: session.access_token,
            expires_in: session.expires_in,
            expires_at: session.expires_at,
            provider_token: session.provider_token || (currentUser?.id === session.user.id ? currentUser?._session?.provider_token : null),
            refresh_token: session.refresh_token,
            token_type: session.token_type,
        } };
        this.user = user;
        this.isAuthenticated = true;
        setCookies(session);
        const wasPending = window.__mgGuestAuth;
        window.__mgGuestAuth = false;
        if (wasPending) authBanner('recovered');
        return user;
    },
    async getUserRoles(userId) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        const roles = this.settings.publicData.userRoleTable
            ? (
                  await this.publicInstance
                      .from(this.settings.publicData.userRoleTable)
                      .select(`role:${this.settings.publicData.userRoleTableRoleColumn || 'roleId'}(*)`)
                      .eq(this.settings.publicData.userRoleTableUserColumn || 'userId', userId)
              ).data.map(({ role }) => role)
            : [];
        return roles;
    },
    async updateUserMeta({ email, phone, metadata }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');

        const user_metadata = (metadata || []).reduce((obj, item) => ({ ...obj, [item.key]: item.value }), {});

        const { data: result, error } = await this.publicInstance.auth.updateUser({
            email,
            phone,
            data: user_metadata,
        });
        if (error) throw new Error(error.message, { cause: error });
        return result;
    },
    async updateUserPassword({ oldPassword, newPassword }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        if (!this.user) throw new Error('User not authenticated.');

        const { error: signInError } = await this.publicInstance.auth.signInWithPassword({
            ...(this.user.email ? { email: this.user.email } : this.user.phone ? { phone: this.user.phone } : null),
            password: oldPassword,
        });
        if (signInError) throw new Error(signInError.message, { cause: signInError });

        const { data: result, error } = await this.publicInstance.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message, { cause: error });
        return result;
    },
    async resetPasswordForEmail({ email, redirectPage }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        const redirectTo = wwLib.manager
            ? `${window.location.origin}/${redirectPage}`
            : `${window.location.origin}${wwLib.wwPageHelper.getPagePath(redirectPage)}`;
        const { error } = await this.publicInstance.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw new Error(error.message, { cause: error });
    },
    async confirmPassword({ newPassword }) {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        const { data } = await this.publicInstance.auth.getSession();
        if (!data?.session?.access_token) throw new Error('No access token provided.');

        const { error } = await this.publicInstance.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message, { cause: error });
    },
    async refreshSession() {
        if (!this.publicInstance) throw new Error('Invalid Supabase Auth configuration.');
        const { error } = await this.publicInstance.auth.refreshSession();
        if (error) throw new Error(error.message, { cause: error });
        // Re-read the current SDK session; a returned refresh result may already
        // have been superseded by logout/login before this continuation runs.
        return this.refreshAuthUser();
    },
};


const setCookies = session => {
    writeSessionCookie('mg-auth-v2-access', session.access_token, Math.max(0, Math.floor(Number(session.expires_at) - Date.now() / 1000)));
    writeSessionCookie('mg-auth-v2-refresh', session.refresh_token, 31536000);
};

const adminFunctions = {
    async _adminGetUsers() {
        if (!this.privateInstance) throw new Error('Invalid Supabase Auth configuration.');
        const response = await this.privateInstance.auth.admin.listUsers({
            page: 1,
            perPage: 10000,
        });
        if (response.error) throw new Error(response.error.message, { cause: response.error });
        return await Promise.all(
            response.data.users.map(async user => ({
                ...user,
                ...user.user_metadata,
                enabled: true,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
                roles: await this._adminGetUserRoles(user.id),
            }))
        );
    },
    async _adminGetUserRoles(userId) {
        if (!this.privateInstance) throw new Error('Invalid Supabase Auth configuration.');
        const roles = this.settings.publicData.userRoleTable
            ? (
                  await this.privateInstance
                      .from(this.settings.publicData.userRoleTable)
                      .select(`role:${this.settings.publicData.userRoleTableRoleColumn || 'roleId'}(*)`)
                      .eq(this.settings.publicData.userRoleTableUserColumn || 'userId', userId)
              ).data.map(({ role }) => role)
            : [];
        return roles;
    },
    async _adminCreateUser(data) {
        const attributes = data.attributes.reduce(
            (obj, attribute) => ({ ...obj, [attribute.key]: attribute.value }),
            {}
        );

        const response = await this.privateInstance.auth.admin.createUser({
            email: data.email,
            email_confirm: true,
            password: data.password,
            user_metadata: { ...attributes, name: data.name },
        });
        if (response.error) throw new Error(response.error.message, { cause: response.error });
        return {
            ...response.data?.user,
            ...response.data?.user?.user_metadata,
            enabled: true,
            createdAt: response.data.created_at,
            updatedAt: response.data.updated_at,
            roles: [],
        };
    },
    async _adminUpdateUser(user, data) {
        const attributes = data.attributes.reduce(
            (obj, attribute) => ({ ...obj, [attribute.key]: attribute.value }),
            {}
        );

        const response = await this.privateInstance.auth.admin.updateUserById(user.id, {
            email: data.email,
            email_confirm: true,
            user_metadata: { ...attributes, name: data.name },
        });
        if (response.error) throw new Error(response.error.message, { cause: response.error });
        return {
            ...response.data.user,
            ...response.data.user.user_metadata,
            enabled: true,
            createdAt: response.data.user.created_at,
            updatedAt: response.data.user.updated_at,
        };
    },
    async _adminUpdateUserPassword(user, password) {
        const { error } = await this.privateInstance.auth.admin.updateUserById(user.id, {
            password: password,
        });
        if (error) throw new Error(error.message, { cause: error });
    },
    async _adminUpdateUserRoles(user, roles) {
        if (!this.settings.publicData.roleTable) {
            const text = 'No valid User Role table defined in Supabase Auth plugin configuration.';
            wwLib.wwNotification.open({ text, color: 'red' });
            throw new Error(text);
        }
        const response = await this.privateInstance
            .from(this.settings.publicData.userRoleTable)
            .delete()
            .match({ [this.settings.publicData.userRoleTableUserColumn || 'userId']: user.id });
        if (response.error) throw new Error(response.error.message, { cause: response.error });
        for (const role of roles) {
            const { error } = await this.privateInstance.from(this.settings.publicData.userRoleTable).insert({
                [this.settings.publicData.userRoleTableRoleColumn || 'roleId']: role.id,
                [this.settings.publicData.userRoleTableUserColumn || 'userId']: user.id,
            });
            if (error) throw new Error(error.message, { cause: error });
        }
    },
    async _adminDeleteUser(user) {
        const { error } = await this.privateInstance.auth.admin.deleteUser(user.id);
        if (error) throw new Error(error.message, { cause: error });
    },
    /* Roles */
    async _adminGetRoles() {
        if (!this.settings.publicData.roleTable) return [];
        const { data: roles, error } = await this.privateInstance.from(this.settings.publicData.roleTable).select();
        if (error) throw new Error(error.message, { cause: error });
        return roles.map(role => ({
            ...role,
            name: role[this.settings.publicData.roleTableNameColumn || 'name'],
            createdAt: role.created_at,
        }));
    },
    async _adminCreateRole(name) {
        if (!this.settings.publicData.roleTable) {
            const text = 'No valid Role table defined in Supabase Auth plugin configuration.';
            wwLib.wwNotification.open({ text, color: 'red' });
            throw new Error(text);
        }
        const { data: roles, error } = await this.privateInstance
            .from(this.settings.publicData.roleTable)
            .insert([{ [this.settings.publicData.roleTableNameColumn || 'name']: name }])
            .select();
        if (error) throw new Error(error.message, { cause: error });
        return {
            ...roles[0],
            name: roles[0][this.settings.publicData.roleTableNameColumn || 'name'],
            createdAt: roles[0].created_at,
        };
    },
    async _adminUpdateRole(roleId, name) {
        const { data: roles, error } = await this.privateInstance
            .from(this.settings.publicData.roleTable)
            .update({ name })
            .match({ id: roleId })
            .select();
        if (error) throw new Error(error.message, { cause: error });
        return {
            ...roles[0],
            name: roles[0][this.settings.publicData.roleTableNameColumn || 'name'],
            createdAt: roles[0].created_at,
        };
    },
    async _adminDeleteRole(roleId) {
        const { error } = await this.privateInstance
            .from(this.settings.publicData.roleTable)
            .delete()
            .match({ id: roleId });
        if (error) throw new Error(error.message, { cause: error });
    },
};
