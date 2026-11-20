// Only the upload being cancelled is removed; never use the old course/lesson video here.
async function remove(url, token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, {method: 'DELETE', headers: {Authorization: `Bearer ${token}`}, signal: controller.signal});
        if (response.status !== 204 && response.status !== 404) throw new Error(`Сервер не подтвердил удаление (${response.status})`);
        return response.status;
    } finally { clearTimeout(timer); }
}
export async function removeUnfinishedUpload({apiBaseUrl, token, uploadId, uncertainFinal = false}) {
    if (!uploadId) throw new Error('Нет идентификатора незавершённой загрузки');
    const status = await remove(`${apiBaseUrl}/api/v1/videos/upload-resumable?upload_id=${encodeURIComponent(uploadId)}`, token);
    // Do not guess a completed video's UUID from a list endpoint.
    // After a lost final response, absence of a session is not proof that its video was deleted.
    if (status === 404 && uncertainFinal) throw new Error('Не удалось подтвердить результат последнего чанка. Состояние загрузки сохранено.');
}
export async function removeCancelledResult({apiBaseUrl, token, uuid, previousVideoId}) {
    if (!uuid || uuid === previousVideoId) throw new Error('Нельзя удалить прежнее видео при отмене загрузки');
    await remove(`${apiBaseUrl}/api/v1/videos/${encodeURIComponent(uuid)}`, token);
}
