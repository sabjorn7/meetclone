import { logClientEvent } from '@/_front/chrome/errorLogger.js';

export default {
    async init() {
        /* wwFront:start */
        const designInfo = wwLib.getFrontWindow().wwg_designInfo;
        await wwLib.$store.dispatch('websiteData/setFullDesign', designInfo);
        /* wwFront:end */
     },

    async fetchPage(pageId) {
 
 
        await fetchData(pageId);
    },

    getPageRoute(pageIdOrLinkId, allowHomePageId) {
        const pages = this.getPages();
        const info = this.getInfo();
        for (const page of pages) {
            if (page.linkId == pageIdOrLinkId || page.id == pageIdOrLinkId) {
                if (allowHomePageId && page.id == info.homePageId) {
                    return '';
                }
                return page.paths[wwLib.wwLang.lang];
            }
        }
        return '';
    },

 
    /**
     * @PUBLIC_API
     * @DEPRECATED
     */
    getWebsiteName() {
        wwLib.wwLog.warn('wwUtils.wwWebsiteData.getWebsiteName is deprecated');
        return wwLib.$store.getters['websiteData/getDesignInfo'].name;
    },

    /**
     * @PUBLIC_API
     */
    getDesign() {
        return wwLib.$store.getters['websiteData/getDesign'] || null;
    },

    /**
     * @PUBLIC_API
     */
    getInfo() {
        const design = this.getDesign();
        return design.info;
    },

    /**
     * @PUBLIC_API
     */
    getPages() {
        const design = this.getDesign();
        return design.pages;
    },

    /**
     * @PUBLIC_API
     */
    getCurrentPage() {
        return wwLib.$store.getters['websiteData/getPage'];
    },

    /**
     * @PUBLIC_API
     */
    getCurrentPageId() {
        return wwLib.$store.getters['websiteData/getPageId'];
    },
};

// Fetch the page data with an 8s timeout and ONE retry (same URL — no cache-bust). Without a
// timeout a data.json request that never reaches the server (common on throttled mobile carriers)
// hangs router.isReady indefinitely → the app never mounts (boot_late). Logs `fetch_retry` so we
// can see whether the retry actually recovers these.
async function fetchPageData(url) {
    // No no-cache header: the URL already carries ?_wwcv=<cacheVersion>, which changes on every
    // deploy (CI rewrites cacheVersion), so each deploy is a DISTINCT, immutable URL safe to cache
    // long-term (nginx: `Cache-Control: public, max-age=31536000, immutable` gated on $arg__wwcv).
    // A second visit on the same version then serves data.json from the HTTP cache (no request),
    // and a new deploy = new ?_wwcv = cache miss = fresh fetch. The cacheVersion-mismatch reload
    // below still catches a bundle/data skew and is itself loop-guarded (ww-cache-reload-version).
    const opts = { timeout: 8000 };
    try {
        return await axios.get(url, opts);
    } catch (err) {
        if (err && err.response) throw err; // got an HTTP response (e.g. a redirect 4xx) → don't retry
        try {
            logClientEvent('fetch_retry', 'data.json retry', {
                path: location.pathname,
                attempt: 1,
                reason: err?.code || (err?.message || 'error').slice(0, 80),
            });
        } catch (e) { /* logging must never break boot */ }
        return await axios.get(url, opts);
    }
}

async function fetchData(pageId) {
    if (!pageId) return;

    let page;

    /* wwFront:start */
    try {
        const base = wwLib.useBaseTag() ? wwLib.getBaseTag() : '/';
        const lang = window.location.pathname.replace(base, '/').startsWith(`/${wwLib.wwLang.lang}/`)
            ? wwLib.wwLang.lang
            : '';

        let url = `${base}data/${pageId.split('_')[0]}.json?wwlang=${lang}&_wwcv=${window.wwg_cacheVersion}`;

        const {
            data: {
                cacheVersion,
                page: pageData,
                sections,
                wwObjects,
                collections,
                variables,
                formulas,
                workflows,
                libraryComponents,
            },
        } = await fetchPageData(url);

        //data.json contains a different cacheVersion
        //due to a deploy before the navigation
        if (cacheVersion != window.wwg_cacheVersion) {
            const reloadedVersion = window.sessionStorage.getItem('ww-cache-reload-version');
            if (reloadedVersion !== String(window.wwg_cacheVersion)) {
                //Reload once to pick up the fresh bundle for this cacheVersion.
                //Guarded by sessionStorage so a persistent mismatch can't loop forever.
                window.sessionStorage.setItem('ww-cache-reload-version', String(window.wwg_cacheVersion));
                //Force a FRESH index.html by navigating to a URL the browser has not cached: a plain
                //location.reload() can re-serve a stale bundle when index.html itself is HTTP-cached.
                const u = new URL(window.location.href);
                u.searchParams.set('_cb', String(cacheVersion));
                window.location.replace(u.toString());
                throw { reloadUrl: true };
            }
            //Already reloaded once for this bundle version and the mismatch persists
            //(e.g. stale data.json behind a cache) - continue instead of reloading again.
            wwLib.wwLog.warn(
                `wwWebsiteData: cacheVersion mismatch persisted after reload (data=${cacheVersion}, bundle=${window.wwg_cacheVersion})`
            );
        }

        if (pageData.cmsDataSetPath) {
            url = `${base}data/${pageId}.json?wwlang=${lang}&_wwcv=${window.wwg_cacheVersion}`;

            // Secondary CMS-index fetch (only for cmsDataSetPath pages). 8s timeout but NO retry on
            // purpose: the primary page-data fetch above already succeeded, so the network is alive;
            // a single extra attempt keeps this simple, and a failure here still surfaces via the
            // outer catch → the router's load-error screen (same as any other fetch failure).
            const {
                data: { page: pageIndexData },
            } = await axios.get(url, { timeout: 8000 });

            for (const key in pageIndexData) {
                pageData[key] = pageIndexData[key];
            }
        }

        if (collections) {
            const promises = [];
            for (const collection of Object.values(collections).filter(collection => collection.mode === 'static')) {
                if (!wwLib.$store.getters['data/getCollections'][collection.id])
                    promises.push(
                        axios
                            .get(`/collections/${collection.id}.json?_wwcv=${window.wwg_cacheVersion}`)
                            .then(({ data }) => (collection.data = data))
                            .catch(err => wwLib.wwLog.error(err))
                    );
            }
            await Promise.all(promises);
        }
        page = { page: pageData, sections, wwObjects };

        await wwLib.$store.dispatch('websiteData/setAllData', {
            page,
            collections,
            variables,
            formulas,
            workflows,
            libraryComponents,
        });
    } catch (err) {
        if (err.reloadUrl) throw err;
        // A WeWeb redirect comes back as a structured 4xx body; a timeout/network error (the retry
        // in fetchPageData also failed) has no response → let the router show the load-error screen.
        const redirectUrl = err?.response?.data?.redirectUrl;
        if (redirectUrl) throw { redirectUrl };
        throw err;
    }
    /* wwFront:end */

 
    // eslint-disable-next-line vue/custom-event-name-casing
    wwLib.$emit('wwStore:dataLoaded');
}
