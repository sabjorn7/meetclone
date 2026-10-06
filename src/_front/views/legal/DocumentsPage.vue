<!--
  Documents hub — single index page listing ALL MeetGuru legal documents with links.
  Linked from the footer "Документы" heading. Content-only (shared AppHeader/AppFooter render globally).
-->
<template>
    <div class="dp">
        <main class="dp-main">
            <h1 class="dp-title">Документы</h1>
            <p class="dp-lead">Правовые документы платформы Meetguru. Нажмите, чтобы открыть полный текст.</p>

            <ul class="dp-list">
                <li v-for="d in docs" :key="d.path">
                    <a :href="d.path" @click.prevent="go(d.path)">
                        <span class="dp-item-name">{{ d.name }}</span>
                        <span v-if="d.desc" class="dp-item-desc">{{ d.desc }}</span>
                    </a>
                </li>
            </ul>
        </main>
    </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

let router = null;
try { router = useRouter(); } catch (e) { router = null; }
function go(path) { if (router) router.push(path); else window.location.href = path; }

const docs = [
    { name: 'Публичная оферта', path: '/oferta', desc: 'Приобретение цифровых продуктов и услуг' },
    { name: 'Политика обработки персональных данных', path: '/politica', desc: 'Как обрабатываются персональные данные' },
    { name: 'Реквизиты и юридическая информация', path: '/rekvizity', desc: 'Сведения о владельце платформы' },
    { name: 'Пользовательское соглашение', path: '/soglashenie', desc: 'Условия использования платформы' },
    { name: 'Согласие на обработку персональных данных', path: '/soglasie', desc: 'Форма согласия субъекта' },
    { name: 'Согласие на обработку и распространение ПД', path: '/soglasie-rasprostranenie', desc: 'Согласие, включая распространение (ст. 10.1 № 152-ФЗ)' },
    { name: 'Условия подписки и регулярных платежей', path: '/podpiska', desc: 'Автопродление и порядок списаний' },
    { name: 'Политика в отношении файлов cookie', path: '/cookie', desc: 'Какие cookie используются и как ими управлять' },
    { name: 'Публичная оферта на участие в очных мероприятиях', path: '/oferta?tab=meropriyatiya', desc: 'Участие в очных семинарах и мероприятиях' },
    { name: 'Правила отмены участия и возврата денежных средств', path: '/vozvrat', desc: 'Порядок отказа, переноса и возврата' },
];
</script>

<style scoped>
.dp {
    min-height: calc(100vh - 62px);
    background: #f6f7f9;
    color: #1f2733;
    font-family: 'Raleway', system-ui, -apple-system, sans-serif;
}
.dp-main { max-width: 760px; margin: 0 auto; padding: 8px 20px 64px; }
.dp-title { font-size: 26px; line-height: 1.25; margin: 8px 0 8px; }
.dp-lead { color: #5b6472; margin: 0 0 22px; font-size: 15px; }
.dp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.dp-list a {
    display: flex; flex-direction: column; gap: 3px;
    background: #fff; border: 1px solid #e9edf2; border-radius: 12px;
    padding: 16px 20px; text-decoration: none; color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.dp-list a:hover { border-color: #2e6fd6; box-shadow: 0 2px 10px rgba(46,111,214,0.08); }
.dp-item-name { font-weight: 600; font-size: 16px; color: #1f2733; }
.dp-item-desc { font-size: 13px; color: #8a94a6; }
@media (max-width: 600px) {
    .dp-title { font-size: 22px; }
    .dp-list a { padding: 14px 16px; }
}
</style>
