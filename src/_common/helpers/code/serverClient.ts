import { sessionDiagnostic, traceCall } from '@/_front/chrome/sessionDiagnostic.js';
import type { BetterFetchPlugin, BetterFetchOption } from '@better-fetch/fetch';
import { createFetch } from '@better-fetch/fetch';
import { getServerUrl } from './backendWorkflows.js';
 
interface QueuedRequest {
    resolve: () => void;
}

function createSecurityAuditPlugin(): BetterFetchPlugin {
    return {
        id: 'security-audit-plugin',
        name: 'Security Audit Plugin',
        hooks: {
            onError(context) {
             },
        },
    };
}

const WW_CONCURRENCY = 4;

let activeRequests = 0;
const queue: QueuedRequest[] = [];

const processQueue = () => {
    while (queue.length > 0 && activeRequests < WW_CONCURRENCY) {
        const next = queue.shift();
        if (next) {
            activeRequests++;
            next.resolve();
        }
    }
};

const baseFetch = createFetch({
    baseURL: getServerUrl() + 'api',
    retry: {
        type: 'linear',
        attempts: 20,
        delay: 100,
        shouldRetry: response => {
            return response.status === 429;
        },
    },
    plugins: [createSecurityAuditPlugin()],
    throw: true,
    credentials: 'include',
 });

async function wwServerClient<T>(url: string, options?: BetterFetchOption): Promise<T> {
    const queueTrace = sessionDiagnostic?.begin('api-queue', 'api');
    if (activeRequests >= WW_CONCURRENCY) {
        await new Promise<void>(resolve => queue.push({ resolve }));
    } else {
        activeRequests++;
    }

    try {
        queueTrace?.end();
        return await traceCall('api-call', 'api', () => baseFetch(url, options));
    } finally {
        activeRequests--;
        processQueue();
    }
}

export default wwServerClient;
