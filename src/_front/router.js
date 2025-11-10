import { createRouter, createWebHistory } from 'vue-router';

import wwPage from './views/wwPage.vue';

import { initializeData, initializePlugins, onPageUnload } from '@/_common/helpers/data';

let router;
const routes = [];

function scrollBehavior(to) {
    if (to.hash) {
        return {
            el: to.hash,
            behavior: 'smooth',
        };
    } else {
        return { top: 0 };
    }
}

 
/* wwFront:start */
import pluginsSettings from '../../plugins-settings.json';

// eslint-disable-next-line no-undef
window.wwg_designInfo = {"id":"c64190db-b628-4e09-b006-ec381176a34c","homePageId":"538a50d6-c665-4121-abd8-63ea97de2d3c","authPluginId":"1fa0dd68-5069-436c-9a7d-3b54c340f1fa","baseTag":null,"defaultTheme":"light","langs":[{"lang":"en","default":true,"isDefaultPath":false}],"background":{},"workflows":[],"pages":[{"id":"538a50d6-c665-4121-abd8-63ea97de2d3c","linkId":"538a50d6-c665-4121-abd8-63ea97de2d3c","name":"Home","folder":null,"paths":{"default":"home"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"a2734adc-4c00-47d6-b8e0-24990971ad94","sectionTitle":"Section","linkId":"0c7d924f-f63d-4d5b-a809-d45d3d935b00"}],"pageUserGroups":[],"title":{"en":"Образовательная платформа Meetguru","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{"en":"Вы получите знания, которые помогут вам освоить профессию мечты и изменить жизнь\n"},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"a7e5fc0b-4735-4c02-b13d-d5473af39982","linkId":"a7e5fc0b-4735-4c02-b13d-d5473af39982","name":"users","folder":null,"paths":{"en":"users","default":"users"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"4b130b03-c324-4d2c-910d-683147cd3127","sectionTitle":"Section","linkId":"6dca2149-9377-4630-bb65-ba354c08005c"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"cf9f551f-e733-4934-a682-535575cb7c70","linkId":"cf9f551f-e733-4934-a682-535575cb7c70","name":"promo","folder":null,"paths":{"en":"promo","default":"promo"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"4a2188f6-d98c-4150-9ba7-5918c72f3421","sectionTitle":"Section","linkId":"416695e7-e54e-4897-9f9a-befeb223f1b0"}],"pageUserGroups":[],"title":{},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"d54ab3f4-9d59-401e-9caf-5e04b3c81a6d","linkId":"d54ab3f4-9d59-401e-9caf-5e04b3c81a6d","name":"soglasie","folder":null,"paths":{"en":"oferta","default":"oferta"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"3a36ba65-741d-45a5-8acc-d8fa518535df","sectionTitle":"Section","linkId":"caff128c-18a0-4e09-9293-7616a4fcc948"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"371cded4-cfe8-4b30-bfc0-23b87e9f6d07","linkId":"371cded4-cfe8-4b30-bfc0-23b87e9f6d07","name":"chats","folder":null,"paths":{"en":"chats","default":"chats"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"fd66ab3e-318c-4fbc-9d5e-56f9ee7947b6","sectionTitle":"Section","linkId":"32c7f064-6792-4b08-a16b-95b3eca179ed"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"c5b548da-d504-4e8e-994a-1e459b6c940f","linkId":"c5b548da-d504-4e8e-994a-1e459b6c940f","name":"TestPage","folder":null,"paths":{"en":"testpage","default":"testpage"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"8117fe94-1484-48ca-be5a-8a30c6ec4a03","sectionTitle":"SignFlow","linkId":"06c1d0be-e9f8-42d0-ae49-ac6a9769e1bb"}],"pageUserGroups":[],"title":{},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"90282a2b-7a1f-4eb5-b3d3-780bf4816dc3","linkId":"90282a2b-7a1f-4eb5-b3d3-780bf4816dc3","name":"login","folder":null,"paths":{"en":"login","default":"login"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"657dbf30-be29-4ddd-8b8c-13393df7d985","sectionTitle":"Section","linkId":"c12e016d-cf67-4602-af9f-1efe702b2369"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"5de1618c-a401-43ed-88c9-8612512e185a","linkId":"5de1618c-a401-43ed-88c9-8612512e185a","name":"components","folder":null,"paths":{"en":"components","default":"components"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"0d761948-5160-4830-8d98-c4170f6962e3","sectionTitle":"Section","linkId":"6d930af3-348c-4b68-83b5-648111206878"}],"pageUserGroups":[],"title":{},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"e0700030-1298-41a8-92c9-42600360fda4","linkId":"e0700030-1298-41a8-92c9-42600360fda4","name":"feedback","folder":null,"paths":{"en":"feedback","default":"feedback"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"89462885-cbcf-4c85-84e7-59b845ad9a04","sectionTitle":"Section","linkId":"60fae0a6-defc-4549-bd6d-0d560954a8c9"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"75f669f5-a96d-454c-8965-38fcf8a6a7a2","linkId":"75f669f5-a96d-454c-8965-38fcf8a6a7a2","name":"registration","folder":null,"paths":{"en":"registration","default":"registration"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"8a11267e-7bdf-49b6-884e-7695e5995b9e","sectionTitle":"Section","linkId":"ee92c7bf-44c3-4c8c-a92b-1cf36ee101c6"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"cbcc1f7b-e8a2-42f5-9b51-2b0f84cdc47f","linkId":"cbcc1f7b-e8a2-42f5-9b51-2b0f84cdc47f","name":"politica","folder":null,"paths":{"en":"politica","default":"politica"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"298fcbfc-b6c8-48cf-98fb-5ef22adce3b9","sectionTitle":"Section","linkId":"eec2d3d1-806b-4ac4-8204-eb75c58220f8"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"4ecb4df0-3af2-4bab-9a7c-d042528f5f17","linkId":"4ecb4df0-3af2-4bab-9a7c-d042528f5f17","name":"article_page","folder":null,"paths":{"en":"article_page","default":"article_page"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"d89cc508-29fa-4a06-98a4-6a18a203eb70","sectionTitle":"Section","linkId":"efb37878-f102-466e-adf2-ed74a2b7dc83"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"23abd7aa-6e39-4e0a-90a5-11e1161e2d3c","linkId":"23abd7aa-6e39-4e0a-90a5-11e1161e2d3c","name":"Ofertauser","folder":null,"paths":{"en":"ofertauser","default":"ofertauser"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"82ee7bef-a5ce-4c0d-a2b3-a0d3e3c9a2f4","sectionTitle":"Section","linkId":"31e12162-f9ae-4968-bac4-f5a0523cd28e"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"7fd85d33-8ff9-4193-8906-544c9b968563","linkId":"7fd85d33-8ff9-4193-8906-544c9b968563","name":"ofertadogovor","folder":null,"paths":{"en":"ofertadogovor","default":"ofertadogovor"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"caafef6e-c52d-4e68-a6b6-ec926fe80624","sectionTitle":"Section","linkId":"7a446d63-f792-41c9-8d40-a651f19ea3af"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"ebc2e39c-597c-4509-8c91-498cf2dac6dc","linkId":"ebc2e39c-597c-4509-8c91-498cf2dac6dc","name":"all_course","folder":null,"paths":{"en":"all_course","default":"all_course"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"fe0f75f6-1d29-4009-b989-5085ef32a12b","sectionTitle":"Section","linkId":"95906ea3-63fe-46bf-b409-357278cb76b9"}],"pageUserGroups":[],"title":{"en":"Образовательная платформа Meetguru","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{"en":"Вы получите знания, которые помогут вам освоить профессию мечты и изменить жизнь\n"},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"4f77bcf6-1c20-4d39-8539-5d641c89f08a","linkId":"4f77bcf6-1c20-4d39-8539-5d641c89f08a","name":"my_courses","folder":null,"paths":{"en":"my_courses","default":"my_courses"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"59683adb-c67c-4128-b3b6-d03296bbfbf5","sectionTitle":"Section","linkId":"8879b043-89b5-45c2-9836-24341734eac8"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"6ff5d3f0-8211-4a41-9774-a6e6a9d8e55d","linkId":"6ff5d3f0-8211-4a41-9774-a6e6a9d8e55d","name":"profile_page","folder":null,"paths":{"en":"profile_page","default":"profile_page"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"5c744d9f-2058-42b0-abca-0b1648f8799e","sectionTitle":"Section","linkId":"82f4b014-63ef-4b56-80c0-c968fbee325e"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"c90db1e7-9bef-4294-a027-20e5a8c12ab1","linkId":"c90db1e7-9bef-4294-a027-20e5a8c12ab1","name":"articles_manage","folder":null,"paths":{"en":"articles_manage","default":"articles_manage"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"98c793b2-bb7c-404c-b6ed-afb5e49fe9ad","sectionTitle":"Section","linkId":"6f4035f2-04b9-4b25-8ce4-254d4fbbcd40"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"16089944-2b20-4dd4-a9a1-f5142bd80c4e","linkId":"16089944-2b20-4dd4-a9a1-f5142bd80c4e","name":"courses_manage","folder":null,"paths":{"en":"courses_manage","default":"courses_manage"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"ee03e528-b0b9-4055-8908-a29e455f2eb0","sectionTitle":"Section","linkId":"ba86a2c1-f2c0-4e0c-b9cc-59ac0d2f8a02"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"6defc1c5-988d-4958-85eb-8c1ec5894fd2","linkId":"6defc1c5-988d-4958-85eb-8c1ec5894fd2","name":"osteo","folder":null,"paths":{"en":"osteo","default":"osteo"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"ab1e5487-3173-4707-a94a-c33cc1bfe5c4","sectionTitle":"Section","linkId":"7650eaf8-66f6-42c7-a490-cb79ee7745eb"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"c6915d2b-337f-4338-bbfe-1269afbf5494","linkId":"c6915d2b-337f-4338-bbfe-1269afbf5494","name":"kinesis","folder":null,"paths":{"en":"kinesis","default":"kinesis"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"36900755-ea5e-44d0-ad54-a4d8e4a0c0a6","sectionTitle":"Section","linkId":"4bfdd1e2-880f-48d3-9f89-25dfd40a17f2"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"7d160a8b-2036-48b5-993d-604eee6febe4","linkId":"7d160a8b-2036-48b5-993d-604eee6febe4","name":"articles","folder":null,"paths":{"en":"articles","default":"articles"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"38d0cc5a-6b6f-4326-8223-acbd22c9a128","sectionTitle":"Section","linkId":"8a741852-dde4-4bf2-835e-efc589977146"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"280224c6-9cbe-4a0f-ae63-a2dff69bf288","linkId":"280224c6-9cbe-4a0f-ae63-a2dff69bf288","name":"Welcome","folder":null,"paths":{"en":"welcome","default":"welcome"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"c436b554-4ca6-46d5-a03e-92a3cb24a53f","sectionTitle":"Section","linkId":"804cddc3-c394-42e7-a19c-3f4736d38494"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"8df505c3-6c02-4a63-9666-e17c4d845756","linkId":"8df505c3-6c02-4a63-9666-e17c4d845756","name":"my_finanse","folder":null,"paths":{"en":"my_finanse","default":"my_finanse"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"f83aa17a-ada1-4483-9723-44688d0c27be","sectionTitle":"Section","linkId":"24febfc2-6623-40f7-aea0-20329fead23f"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"ebfd1ed0-0a1b-4fde-a367-a13bcf082fb7","linkId":"ebfd1ed0-0a1b-4fde-a367-a13bcf082fb7","name":"FAQ","folder":null,"paths":{"en":"faq","default":"faq"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"217599f7-f282-4091-bae9-c088102a99b9","sectionTitle":"Section","linkId":"7a884ebf-f15a-4f5e-bfb1-044e20173aa6"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"c6c3da50-f797-4a2c-b536-fba08c7814a1","linkId":"c6c3da50-f797-4a2c-b536-fba08c7814a1","name":"about_meet","folder":null,"paths":{"en":"about_meet","default":"about_meet"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"e8dce5a3-1c80-4d5c-bebe-036fb9293bac","sectionTitle":"Section","linkId":"ee4db520-b566-49ec-a4b6-683466415085"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"91500af7-1e7e-44d6-8281-fa14d09331e7","linkId":"91500af7-1e7e-44d6-8281-fa14d09331e7","name":"contacts","folder":null,"paths":{"en":"contacts","default":"contacts"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"24c56ea3-3e07-46b2-b719-844a8e211608","sectionTitle":"Section","linkId":"9adc00e1-2239-4ae5-85a8-5c8acc9989bd"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"92ec31d3-970a-4fa4-9a30-db92e6b3a03d","linkId":"92ec31d3-970a-4fa4-9a30-db92e6b3a03d","name":"profile","folder":null,"paths":{"en":"profile","default":"profile"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"f2f7bdca-2351-4680-b1b8-dab3c68c9e41","sectionTitle":"Section","linkId":"9d2c2c7c-a3e0-447d-a4b7-50bb298cc5de"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"daa28e21-4460-44af-88ef-c9cbdfdd3505","linkId":"daa28e21-4460-44af-88ef-c9cbdfdd3505","name":"superadmin","folder":null,"paths":{"en":"superadmin","default":"superadmin"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"40408944-710a-4e0c-ab91-95c88f08dcce","sectionTitle":"Section","linkId":"18465c4d-2185-428e-a204-0a5e860cffb1"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"290e681e-b2ff-42f7-bdba-3068889e6a0b","linkId":"290e681e-b2ff-42f7-bdba-3068889e6a0b","name":"course_info","folder":null,"paths":{"en":"course_info","default":"course_info"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"c84d5c18-6a1b-40b1-b8ed-f5f1569acfc1","sectionTitle":"Section","linkId":"f542d725-4c53-41bd-bd2e-1d966b9f4b86"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""},{"id":"63d172e4-bec1-4021-9b5e-0817819aad7b","linkId":"63d172e4-bec1-4021-9b5e-0817819aad7b","name":"reset_pw","folder":null,"paths":{"en":"reset_pw","default":"reset_pw"},"langs":["en"],"cmsDataSetPath":null,"sections":[{"uid":"c0b12b7b-2f48-4ffe-a6ea-9a4adc02d134","sectionTitle":"Section","linkId":"36f256ea-1dfc-4945-98e5-04c0cac688c8"}],"pageUserGroups":[],"title":{"en":"","fr":"Vide | Commencer à partir de zéro"},"meta":{"desc":{},"keywords":{},"socialDesc":{},"socialTitle":{},"structuredData":{}},"metaImage":""}],"plugins":[{"id":"f9ef41c3-1c53-4857-855b-f2f6a40b7186","name":"Supabase","namespace":"supabase"},{"id":"1fa0dd68-5069-436c-9a7d-3b54c340f1fa","name":"Supabase Auth","namespace":"supabaseAuth"},{"id":"832d6f7a-42c3-43f1-a3ce-9a678272f811","name":"Date","namespace":"dayjs"},{"id":"2bd1c688-31c5-443e-ae25-59aa5b6431fb","name":"REST API","namespace":"restApi"}]};
// eslint-disable-next-line no-undef
window.wwg_cacheVersion = 209;
// eslint-disable-next-line no-undef
window.wwg_pluginsSettings = pluginsSettings;
// eslint-disable-next-line no-undef
window.wwg_disableManifest = false;

const defaultLang = window.wwg_designInfo.langs.find(({ default: isDefault }) => isDefault) || {};

const registerRoute = (page, lang, forcedPath) => {
    const langSlug = !lang.default || lang.isDefaultPath ? `/${lang.lang}` : '';
    let path =
        forcedPath ||
        (page.id === window.wwg_designInfo.homePageId ? '/' : `/${page.paths[lang.lang] || page.paths.default}`);

    //Replace params
    path = path.replace(/{{([\w]+)\|([^/]+)?}}/g, ':$1');

    routes.push({
        path: langSlug + path,
        component: wwPage,
        name: `page-${page.id}-${lang.lang}`,
        meta: {
            pageId: page.id,
            lang,
            isPrivate: !!page.pageUserGroups?.length,
        },
        async beforeEnter(to, from) {
            if (to.name === from.name) return;
            //Set page lang
            wwLib.wwLang.defaultLang = defaultLang.lang;
            wwLib.$store.dispatch('front/setLang', lang.lang);

            //Init plugins
            await initializePlugins();

            //Check if private page
            if (page.pageUserGroups?.length) {
                // cancel navigation if no plugin
                if (!wwLib.wwAuth.plugin) {
                    return false;
                }

                await wwLib.wwAuth.init();

                // Redirect to not sign in page if not logged
                if (!wwLib.wwAuth.getIsAuthenticated()) {
                    window.location.href = `${wwLib.wwPageHelper.getPagePath(
                        wwLib.wwAuth.getUnauthenticatedPageId()
                    )}?_source=${to.path}`;

                    return null;
                }

                //Check roles are required
                if (
                    page.pageUserGroups.length > 1 &&
                    !wwLib.wwAuth.matchUserGroups(page.pageUserGroups.map(({ userGroup }) => userGroup))
                ) {
                    window.location.href = `${wwLib.wwPageHelper.getPagePath(
                        wwLib.wwAuth.getUnauthorizedPageId()
                    )}?_source=${to.path}`;

                    return null;
                }
            }

            try {
                await import(`@/pages/${page.id.split('_')[0]}.js`);
                await wwLib.wwWebsiteData.fetchPage(page.id);

                //Scroll to section or on top after page change
                if (to.hash) {
                    const targetElement = document.getElementById(to.hash.replace('#', ''));
                    if (targetElement) targetElement.scrollIntoView();
                } else {
                    document.body.scrollTop = document.documentElement.scrollTop = 0;
                }

                return;
            } catch (err) {
                wwLib.$store.dispatch('front/showPageLoadProgress', false);

                if (err.redirectUrl) {
                    return { path: err.redirectUrl || '404' };
                } else {
                    //Any other error: go to target page using window.location
                    window.location = to.fullPath;
                }
            }
        },
    });
};

for (const page of window.wwg_designInfo.pages) {
    for (const lang of window.wwg_designInfo.langs) {
        if (!page.langs.includes(lang.lang)) continue;
        registerRoute(page, lang);
    }
}

const page404 = window.wwg_designInfo.pages.find(page => page.paths.default === '404');
if (page404) {
    for (const lang of window.wwg_designInfo.langs) {
        // Create routes /:lang/:pathMatch(.*)* etc for all langs of the 404 page
        if (!page404.langs.includes(lang.lang)) continue;
        registerRoute(
            page404,
            {
                default: false,
                lang: lang.lang,
            },
            '/:pathMatch(.*)*'
        );
    }
    // Create route /:pathMatch(.*)* using default project lang
    registerRoute(page404, { default: true, isDefaultPath: false, lang: defaultLang.lang }, '/:pathMatch(.*)*');
} else {
    routes.push({
        path: '/:pathMatch(.*)*',
        async beforeEnter() {
            window.location.href = '/404';
        },
    });
}

let routerOptions = {};

const isProd =
    !window.location.host.includes(
        // TODO: add staging2 ?
        '-staging.' + (process.env.WW_ENV === 'staging' ? import.meta.env.VITE_APP_PREVIEW_URL : '')
    ) && !window.location.host.includes(import.meta.env.VITE_APP_PREVIEW_URL);

if (isProd && window.wwg_designInfo.baseTag?.href) {
    let baseTag = window.wwg_designInfo.baseTag.href;
    if (!baseTag.startsWith('/')) {
        baseTag = '/' + baseTag;
    }
    if (!baseTag.endsWith('/')) {
        baseTag += '/';
    }

    routerOptions = {
        base: baseTag,
        history: createWebHistory(baseTag),
        routes,
    };
} else {
    routerOptions = {
        history: createWebHistory(),
        routes,
    };
}

router = createRouter({
    ...routerOptions,
    scrollBehavior,
});

//Trigger on page unload
let isFirstNavigation = true;
router.beforeEach(async (to, from) => {
    if (to.name === from.name) return;
    if (!isFirstNavigation) await onPageUnload();
    isFirstNavigation = false;
    wwLib.globalVariables._navigationId++;
    return;
});

//Init page
router.afterEach((to, from, failure) => {
    wwLib.$store.dispatch('front/showPageLoadProgress', false);
    let fromPath = from.path;
    let toPath = to.path;
    if (!fromPath.endsWith('/')) fromPath = fromPath + '/';
    if (!toPath.endsWith('/')) toPath = toPath + '/';
    if (failure || (from.name && toPath === fromPath)) return;
    initializeData(to);
});
/* wwFront:end */

export default router;
