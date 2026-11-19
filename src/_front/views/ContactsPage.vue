<template>
    <div class="contacts">
        <main class="contacts-main">
            <h1>Контакты</h1>
            <p class="contacts-lead">Свяжитесь с нами любым удобным способом.</p>

            <dl class="contacts-list">
                <div class="contact">
                    <dt>Электронная почта</dt>
                    <dd><a href="mailto:adv@meetgu.ru">adv@meetgu.ru</a></dd>
                </div>
                <div class="contact">
                    <dt>Telegram</dt>
                    <dd><a href="https://t.me/qwezaq" target="_blank" rel="noopener noreferrer">@qwezaq</a></dd>
                </div>
                <div class="contact">
                    <dt>Телефон</dt>
                    <dd><a href="tel:+79824979556">+7 982 497 95 56</a></dd>
                </div>
                <div class="contact contact-address">
                    <dt>Адрес</dt>
                    <dd><address>119192, г. Москва,<br />Мичуринский проспект, д. 54, корп. 2</address></dd>
                </div>
            </dl>

            <nav class="contacts-links" aria-label="Полезные ссылки">
                <a href="/faq">Вопросы и ответы</a>
                <a href="/rekvizity">Реквизиты и юридическая информация</a>
            </nav>
        </main>
    </div>
</template>

<style scoped>
.contacts {
    min-height: calc(100vh - 62px);
    background: #f6f7f9;
    color: #1f2733;
    font-family: 'Raleway', system-ui, -apple-system, sans-serif;
}
.contacts-main { max-width: 900px; margin: 0 auto; padding: 8px 20px 64px; }
h1 { margin: 8px 0; font-size: 26px; line-height: 1.25; }
.contacts-lead { margin: 0 0 24px; color: #5b6472; font-size: 15px; line-height: 1.6; }
.contacts-list { margin: 0; padding: 8px 32px; background: #fff; border: 1px solid #e9edf2; border-radius: 12px; }
.contact { display: grid; grid-template-columns: 190px minmax(0, 1fr); align-items: baseline; gap: 24px; padding: 20px 0; }
.contact + .contact { border-top: 1px solid #e9edf2; }
dt { color: #5b6472; font-size: 14px; line-height: 1.6; }
dd { margin: 0; min-width: 0; font-size: 18px; font-weight: 600; line-height: 1.6; }
a { color: #2e6fd6; text-decoration: none; overflow-wrap: anywhere; }
dd a { display: inline-flex; align-items: center; min-height: 44px; }
a:hover { text-decoration: underline; text-underline-offset: 4px; }
a:focus-visible { outline: 2px solid #2e6fd6; outline-offset: 4px; border-radius: 2px; }
address { font-style: normal; font-size: 16px; font-weight: 400; line-height: 1.7; }
.contacts-links { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 20px; font-size: 14px; }
.contacts-links a { display: inline-flex; align-items: center; min-height: 44px; }
@media (max-width: 600px) {
    h1 { font-size: 24px; }
    .contacts-list { padding: 4px 20px; }
    .contact { grid-template-columns: minmax(0, 1fr); gap: 2px; padding: 16px 0; }
    .contact-address { gap: 8px; }
    dd { font-size: 18px; }
}
</style>
