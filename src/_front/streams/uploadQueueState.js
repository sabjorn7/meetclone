// Tiny shell bridge: no uploader, API client or panel is loaded until the first task.
import { shallowRef } from 'vue';
export const uploadQueueState = shallowRef([]);
let loading;
export function getUploadQueue() {
    if (!loading) loading = import('./uploadQueueRuntime.js').then(m => m.uploadQueue).catch(error => { loading = null; throw error; });
    return loading;
}
