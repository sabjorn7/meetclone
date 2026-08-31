// Course-completion certificate helpers. The PDF is generated on the CLIENT from the rendered
// CourseCertificate.vue node: html2canvas → jsPDF (A4 landscape). Both libs are imported dynamically
// inside downloadCertificatePdf() so they never touch the initial bundle — only loaded on click.

// Deterministic certificate number from a stable seed (the user_course row id). Same enrollment always
// yields the same number, so it can be verified later by recomputing — no extra table needed.
export function certNumber(seed) {
    const hex = String(seed || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    const s = (hex + '00000000').slice(0, 8);
    return `MG-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export function certDate(d = new Date()) {
    const dt = d instanceof Date ? d : new Date(d);
    return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()} г.`;
}

// Turn a rendered certificate DOM node into an A4-landscape PDF and trigger a download.
export async function downloadCertificatePdf(el, filename = 'Сертификат.pdf') {
    if (!el) return;
    const [{ default: html2canvas }, jspdf] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
    ]);
    const JsPDF = jspdf.jsPDF || jspdf.default;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    // JPEG q0.95 — visually identical on a mostly-white certificate but ~20× smaller than PNG (7.7MB → ~0.4MB)
    const img = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    // fit the whole A4 landscape page (297×210 mm); the node keeps the same 297:210 ratio
    pdf.addImage(img, 'JPEG', 0, 0, 297, 210);
    pdf.save(filename.replace(/[\\/:*?"<>|]+/g, ' ').trim());
}

// Sanitize a course title into a friendly file name.
export function certFilename(course) {
    const t = (course || 'курс').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80);
    return `Сертификат — ${t}.pdf`;
}
