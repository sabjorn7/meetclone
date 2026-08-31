<!--
  CoursesManagePage.vue — "/courses_manage" (creator course management) in the MeetGuru promo (pd-*)
  brand language. Hand-written rebuild of the WeWeb page, done in phases (see the redesign plan):

    PHASE 0 (this file, current) — scaffold + access gate + READ-ONLY course list. No writes.
      Later phases add: 1) metadata create/edit/delete, 2) pricing & moderation, 3) lessons,
      4) PeerTube video upload (reusing the proven uploader element), 5) grants/bans/chat.

  Demo at /courses-manage-demo; the live WeWeb page stays untouched until go-live. Gets the shared
  AppHeader/AppFooter.

  ACCESS: this is a creator-only surface (same gate the header nav uses).
    - guest → /login
    - logged in but not a creator (role ∉ {Спикер, Учебное заведение, admin}) → / (home)
    - creator → show only their own courses (owner = me)
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <div v-if="loading" class="pd-wrap pd-load">Загрузка…</div>

        <section v-else class="pd-section" :class="{ 'has-salebar': discountMode }">
            <div class="pd-wrap">
                <header class="pd-head" data-reveal>
                    <div class="pd-head__row">
                        <div>
                            <h1 class="pd-head__title">Управление курсами</h1>
                            <p class="pd-head__descr">Ваши курсы, статусы модерации и материалы. Нажмите на курс, чтобы отредактировать.</p>
                        </div>
                        <div class="pd-head__btns">
                            <button type="button" class="pd-btn pd-btn--ghost" :class="{ 'is-on': discountMode }" @click="discountMode ? exitDiscountMode() : enterDiscountMode()">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M9 9h.01M15 15h.01M16 8L8 16M3 5a2 2 0 0 1 2-2h6l10 10-8 8L3 11z"/></svg>
                                {{ discountMode ? 'Выйти из скидок' : 'Скидки' }}
                            </button>
                            <button type="button" class="pd-btn" :disabled="discountMode" @click="openCreate">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                                Добавить курс
                            </button>
                        </div>
                    </div>
                </header>

                <div class="pd-toolbar" data-reveal>
                    <div class="pd-search">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                        <input v-model="search" type="search" placeholder="Поиск по названию" aria-label="Поиск по названию" />
                    </div>
                    <div class="pd-chips">
                        <button type="button" class="pd-chip pd-chip--gear" title="Управление папками" aria-label="Управление папками" @click="foldersOpen = true">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </button>
                        <button type="button" class="pd-chip" :class="{ 'is-on': filter === 'all' }" @click="filter = 'all'">Все <span class="pd-chip__n">{{ courses.length }}</span></button>
                        <button v-if="discountCount" type="button" class="pd-chip" :class="{ 'is-on': filter === 'discount' }" @click="filter = 'discount'">Скидки <span class="pd-chip__n">{{ discountCount }}</span></button>
                        <button v-if="fixCount" type="button" class="pd-chip pd-chip--warn" :class="{ 'is-on': filter === 'fix' }" @click="filter = 'fix'">Нужно исправить <span class="pd-chip__n">{{ fixCount }}</span></button>
                        <span v-if="folders.length" class="pd-chips__sep" aria-hidden="true"></span>
                        <button v-for="f in folders" :key="f.id" type="button" class="pd-chip" :class="{ 'is-on': filter === f.id }" @click="filter = f.id">
                            <svg viewBox="0 0 24 24" class="pd-ic pd-chip__ic" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                            {{ f.title }} <span class="pd-chip__n">{{ folderCount(f.id) }}</span>
                        </button>
                    </div>
                </div>

                <p class="pd-count" data-reveal>{{ visible.length }} {{ plural(visible.length, ['курс', 'курса', 'курсов']) }}</p>

                <ul v-if="visible.length" class="pd-grid" data-reveal>
                    <li
                        v-for="c in visible" :key="c.id"
                        class="pd-card pd-card--btn"
                        :class="{ 'is-sel': discountMode && selected.has(c.id), 'is-free': discountMode && c.Free }"
                        tabindex="0" role="button"
                        @click="discountMode ? (!c.Free && toggleSelect(c.id)) : openEdit(c)"
                        @keydown.enter="discountMode ? (!c.Free && toggleSelect(c.id)) : openEdit(c)"
                    >
                        <div class="pd-card__top">
                            <span v-if="discountMode && !c.Free" class="pd-check-box" :class="{ 'is-on': selected.has(c.id) }" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 6"/></svg>
                            </span>
                            <span class="pd-badge" :class="`pd-badge--${statusMeta(c.ModStatus).cls}`">{{ statusMeta(c.ModStatus).label }}</span>
                            <span v-if="hasDiscount(c)" class="pd-badge pd-badge--sale">Скидка</span>
                        </div>
                        <h2 class="pd-card__title">{{ c.Title || 'Без названия' }}</h2>
                        <div class="pd-card__meta">
                            <span class="pd-price">{{ priceLabel(c) }}<s v-if="hasDiscount(c)" class="pd-oldprice">{{ num(c.old_price).toLocaleString('ru-RU') }} ₽</s></span>
                            <span class="pd-dot" aria-hidden="true">·</span>
                            <span class="pd-meta-i">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
                                {{ lessonCount(c) }} {{ plural(lessonCount(c), ['урок', 'урока', 'уроков']) }}
                            </span>
                            <template v-if="durationLabel(c)">
                                <span class="pd-dot" aria-hidden="true">·</span>
                                <span class="pd-meta-i">
                                    <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/></svg>
                                    {{ durationLabel(c) }}
                                </span>
                            </template>
                            <span v-if="c.video_id" class="pd-dot" aria-hidden="true">·</span>
                            <span v-if="c.video_id" class="pd-meta-i pd-meta-i--ok">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 5h16v14H4zM10 9l5 3-5 3z"/></svg>
                                Тизер
                            </span>
                        </div>
                        <p v-if="modNote(c)" class="pd-card__note">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
                            {{ modNote(c) }}
                        </p>
                        <div class="pd-card__foot">
                            <span v-if="folderTitle(c.folder)" class="pd-folder">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                                {{ folderTitle(c.folder) }}
                            </span>
                            <a v-if="c.slug" class="pd-card__link" :href="`/course/${c.slug}`" target="_blank" rel="noopener noreferrer" @click.stop>Открыть страницу →</a>
                        </div>
                    </li>
                </ul>
                <p v-else class="pd-empty" data-reveal>Ничего не найдено.</p>
            </div>

            <!-- bulk-discount action bar (sticky) -->
            <div v-if="discountMode" class="pd-salebar">
                <div class="pd-wrap pd-salebar__in">
                    <div class="pd-salebar__sel">
                        <b>Выбрано: {{ selected.size }}</b>
                        <button type="button" class="pd-link" @click="selectAllVisible">Все</button>
                        <button type="button" class="pd-link" @click="selectDiscounted">Со скидкой</button>
                        <button v-if="selected.size" type="button" class="pd-link" @click="clearSelection">Снять</button>
                    </div>
                    <div class="pd-salebar__act">
                        <label class="pd-salebar__pct">Скидка <input v-model.number="discountPercent" type="number" min="1" max="99" /> %</label>
                        <button type="button" class="pd-btn pd-btn--sm" :disabled="!selected.size || discountBusy" @click="discountConfirm = 'apply'">Применить</button>
                        <button type="button" class="pd-btn pd-btn--sm pd-btn--ghost" :disabled="!selected.size || discountBusy" @click="discountConfirm = 'remove'">Убрать скидку</button>
                    </div>
                    <p v-if="discountError" class="pd-formerr pd-formerr--inline">{{ discountError }}</p>
                </div>

                <div v-if="discountConfirm" class="pd-modal" @click.self="discountConfirm = null">
                    <div class="pd-confirm__box">
                        <p class="pd-confirm__t">{{ discountConfirm === 'apply' ? `Скидка ${discountPercent}% на ${selected.size} курс(ов)?` : `Убрать скидку с ${selected.size} курс(ов)?` }}</p>
                        <p class="pd-confirm__d">Меняется цена (и «старая цена») выбранных курсов, в том числе опубликованных. Действие сразу отражается в каталоге.</p>
                        <div class="pd-confirm__foot">
                            <button type="button" class="pd-btn pd-btn--ghost" @click="discountConfirm = null">Отмена</button>
                            <button type="button" class="pd-btn" :disabled="discountBusy" @click="runBulk(discountConfirm)">{{ discountBusy ? 'Применяем…' : 'Подтвердить' }}</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- course create / edit modal (metadata only — no money) -->
        <div v-if="editing" class="pd-modal" @click.self="closeModal">
            <div class="pd-dialog" role="dialog" aria-modal="true">
                <div class="pd-dialog__head">
                    <h2 class="pd-dialog__title">{{ editing.isCreate ? 'Новый курс' : 'Редактирование курса' }}</h2>
                    <button type="button" class="pd-x" aria-label="Закрыть" @click="closeModal">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                </div>

                <div v-if="!form" class="pd-dialog__body pd-dialog__body--load">Загрузка…</div>
                <div v-else class="pd-dialog__body">
                    <!-- shown right after a course is created — the modal stays open in edit mode -->
                    <div v-if="justCreated" class="pd-created">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
                        <span>Курс создан — теперь добавьте уроки.</span>
                    </div>

                    <!-- moderation / publication (existing courses only) -->
                    <div v-if="!editing.isCreate" class="pd-modblock">
                        <div class="pd-modblock__row">
                            <span class="pd-modblock__lb">Статус</span>
                            <span class="pd-badge" :class="`pd-badge--${statusMeta(editing.ModStatus).cls}`">{{ statusMeta(editing.ModStatus).label }}</span>
                            <span class="pd-spacer"></span>
                            <button
                                v-if="nextStatusAction()" type="button"
                                class="pd-btn pd-btn--sm" :class="nextStatusAction().danger ? 'pd-btn--dangerghost' : 'pd-btn--ghost'"
                                :disabled="statusBusy" @click="setStatus(nextStatusAction().to)">
                                {{ statusBusy ? '…' : nextStatusAction().label }}
                            </button>
                        </div>
                        <p v-if="editing.ModStatus === 'Отправлено на модерацию'" class="pd-modblock__hint">Курс на проверке у модератора. Публикацию подтверждает администратор.</p>
                        <p v-if="modNote(editing)" class="pd-modblock__note">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
                            Замечание модератора: {{ modNote(editing) }}
                        </p>
                    </div>

                    <div v-if="!editable" class="pd-lock">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/></svg>
                        <span>Курс {{ editing.ModStatus === 'Опубликовано' ? 'опубликован' : 'на модерации' }} — текст, цену, уроки и видео нельзя менять. Чтобы отредактировать, снимите его с публикации (кнопка выше).</span>
                    </div>

                    <label class="pd-field">
                        <span class="pd-field__lb">Название<b class="pd-req">*</b></span>
                        <input v-model="form.Title" type="text" class="pd-input" placeholder="Название курса" maxlength="200" :readonly="!editable" />
                    </label>

                    <div class="pd-field">
                        <span class="pd-field__lb">Тип</span>
                        <div class="pd-seg">
                            <button v-for="cat in CATEGORIES" :key="cat" type="button" class="pd-seg__b" :class="{ 'is-on': form.Category === cat }" :disabled="!editable" @click="form.Category = cat">{{ cat }}</button>
                        </div>
                    </div>

                    <label class="pd-field">
                        <span class="pd-field__lb">Описание</span>
                        <textarea v-model="form.Decription" class="pd-input pd-textarea" rows="3" placeholder="О чём этот курс" maxlength="4000" :readonly="!editable"></textarea>
                    </label>

                    <label class="pd-field">
                        <span class="pd-field__lb">Чему научит</span>
                        <textarea v-model="form.WhatTeach" class="pd-input pd-textarea" rows="3" placeholder="Программа, навыки, результат" maxlength="8000" :readonly="!editable"></textarea>
                    </label>

                    <label class="pd-field">
                        <span class="pd-field__lb">Для кого курс</span>
                        <textarea v-model="form.For" class="pd-input pd-textarea" rows="2" placeholder="Целевая аудитория" maxlength="2000" :readonly="!editable"></textarea>
                    </label>

                    <label class="pd-field">
                        <span class="pd-field__lb">Папка</span>
                        <!-- folder assignment is organizational metadata — always editable, even when the
                             course is published/on moderation. Persists immediately (bypasses the edit-lock). -->
                        <select v-model="form.folder" class="pd-input pd-select" @change="assignFolder">
                            <option :value="null">Без папки</option>
                            <option v-for="f in folders" :key="f.id" :value="f.id">{{ f.title }}</option>
                        </select>
                    </label>

                    <!-- access & price -->
                    <div class="pd-money">
                        <span class="pd-money__h">Доступ и цена</span>
                        <label class="pd-check">
                            <input v-model="form.Free" type="checkbox" :disabled="!editable" />
                            <span>Бесплатный курс</span>
                        </label>

                        <template v-if="!form.Free">
                            <div class="pd-row2">
                                <label class="pd-field">
                                    <span class="pd-field__lb">Цена, ₽</span>
                                    <input v-model.number="form.Price" type="number" min="0" step="100" class="pd-input" :readonly="!editable" placeholder="0" />
                                </label>
                                <label class="pd-field">
                                    <span class="pd-field__lb">Старая цена, ₽ <em class="pd-opt">для скидки</em></span>
                                    <input v-model.number="form.old_price" type="number" min="0" step="100" class="pd-input" :readonly="!editable" placeholder="—" />
                                </label>
                            </div>

                            <div class="pd-field">
                                <span class="pd-field__lb">Срок доступа</span>
                                <div class="pd-seg">
                                    <button v-for="d in DURATIONS" :key="d.v" type="button" class="pd-seg__b" :class="{ 'is-on': form.DurationLong === d.v }" :disabled="!editable" @click="form.DurationLong = d.v">{{ d.label }}</button>
                                </div>
                            </div>

                            <label v-if="form.DurationLong !== 0" class="pd-field">
                                <span class="pd-field__lb">Цена продления, ₽ <em class="pd-opt">после окончания срока</em></span>
                                <input v-model.number="form.DurationPrice" type="number" min="0" step="100" class="pd-input" :readonly="!editable" placeholder="0" />
                            </label>

                            <label class="pd-check">
                                <input v-model="form.Buy" type="checkbox" :disabled="!editable" />
                                <span>Доступен к покупке</span>
                            </label>
                        </template>
                    </div>

                    <!-- course cover image (existing courses only) — used where there's no teaser + as its poster -->
                    <div v-if="!editing.isCreate" class="pd-teaser">
                        <span class="pd-money__h">Обложка курса</span>
                        <div v-if="editing.cover" class="pd-cover">
                            <img :src="editing.cover" alt="Обложка курса" class="pd-cover__img" />
                            <div class="pd-vactions">
                                <label class="pd-btn pd-btn--ghost pd-btn--sm pd-upl">
                                    <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg> Заменить
                                    <input type="file" accept="image/*" class="pd-hidden-file" :disabled="coverBusy" @change="onCoverUpload" />
                                </label>
                                <button type="button" class="pd-btn pd-btn--dangerghost pd-btn--sm" :disabled="coverBusy" @click="removeCover">{{ coverBusy ? 'Удаляем…' : 'Удалить' }}</button>
                            </div>
                        </div>
                        <label v-else class="pd-btn pd-btn--ghost pd-btn--sm pd-upl">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg> {{ coverBusy ? 'Загрузка…' : 'Загрузить обложку' }}
                            <input type="file" accept="image/*" class="pd-hidden-file" :disabled="coverBusy" @change="onCoverUpload" />
                        </label>
                        <p class="pd-hint">Показывается в каталоге и на странице курса, где нет видео, и как заставка тизера.</p>
                    </div>

                    <!-- course teaser video (existing courses only) -->
                    <div v-if="!editing.isCreate" class="pd-teaser">
                        <span class="pd-money__h">Тизер курса</span>
                        <div v-if="videoUploading && videoTarget === 'course'" class="pd-vprog">
                            <div class="pd-vprog__bar"><span :style="{ transform: `scaleX(${videoProgress / 100})` }"></span></div>
                            <span class="pd-vprog__t">Загрузка… {{ videoProgress }}%</span>
                        </div>
                        <template v-else-if="editing.video_id">
                            <div class="pd-vframe"><iframe :src="embedUrl(editing.video_id, { autoplay: false })" title="Тизер курса" frameborder="0" allowfullscreen allow="fullscreen; picture-in-picture"></iframe></div>
                            <div class="pd-vactions">
                                <label class="pd-btn pd-btn--ghost pd-btn--sm pd-upl">
                                    <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg> Заменить
                                    <input type="file" accept="video/*" class="pd-hidden-file" :disabled="videoUploading" @change="onCourseVideo" />
                                </label>
                                <button type="button" class="pd-btn pd-btn--dangerghost pd-btn--sm" :disabled="videoBusy" @click="removeCourseVideo">{{ videoBusy ? 'Удаляем…' : 'Удалить' }}</button>
                            </div>
                        </template>
                        <div v-else-if="editing.resume_video_id" class="pd-vresume">
                            <p class="pd-hint">Загрузка «{{ editing.resume_name || 'видео' }}» не завершена. Выберите тот же файл, чтобы продолжить.</p>
                            <label class="pd-btn pd-btn--sm pd-upl">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg> Продолжить загрузку
                                <input type="file" accept="video/*" class="pd-hidden-file" @change="onCourseVideo" />
                            </label>
                        </div>
                        <label v-else class="pd-btn pd-btn--ghost pd-btn--sm pd-upl">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg> Загрузить тизер
                            <input type="file" accept="video/*" class="pd-hidden-file" @change="onCourseVideo" />
                        </label>
                        <p v-if="videoError && videoTarget === 'course'" class="pd-formerr pd-formerr--inline">{{ videoError }}</p>
                    </div>

                    <!-- lessons (existing courses only) -->
                    <div v-if="!editing.isCreate" class="pd-lessons">
                        <div class="pd-lessons__head">
                            <span class="pd-money__h">Уроки курса</span>
                            <button type="button" class="pd-btn pd-btn--sm" :disabled="!editable" @click="addLesson">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                                Добавить урок
                            </button>
                        </div>
                        <p v-if="lessonsLoading" class="pd-hint">Загрузка уроков…</p>
                        <ul v-else-if="lessons.length" class="pd-llist">
                            <li v-for="(l, i) in lessons" :key="l.id" class="pd-lrow">
                                <span class="pd-lrow__n">{{ i + 1 }}</span>
                                <span class="pd-lrow__t">
                                    {{ l.Title || 'Без названия' }}
                                    <svg v-if="l.File" viewBox="0 0 24 24" class="pd-ic pd-lrow__ic" aria-hidden="true"><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                                    <svg v-if="l.video_id" viewBox="0 0 24 24" class="pd-ic pd-lrow__ic pd-lrow__ic--v" aria-hidden="true"><path d="M4 5h16v14H4zM10 9l5 3-5 3z"/></svg>
                                </span>
                                <span class="pd-lrow__act">
                                    <button type="button" class="pd-iconbtn" :disabled="i === 0 || lessonBusyId || !editable" aria-label="Выше" @click="moveLesson(i, -1)"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg></button>
                                    <button type="button" class="pd-iconbtn" :disabled="i === lessons.length - 1 || lessonBusyId || !editable" aria-label="Ниже" @click="moveLesson(i, 1)"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
                                    <button type="button" class="pd-iconbtn" aria-label="Изменить" :disabled="!editable" @click="openLessonEdit(l)"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                                    <button type="button" class="pd-iconbtn pd-iconbtn--del" :disabled="lessonBusyId === l.id || !editable" aria-label="Удалить" @click="deleteLesson(l)"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></button>
                                </span>
                            </li>
                        </ul>
                        <p v-else class="pd-hint">Уроков пока нет. Нажмите «Добавить урок».</p>
                        <p v-if="lessonError" class="pd-formerr pd-formerr--inline">{{ lessonError }}</p>
                    </div>

                    <!-- course roster + manual grants (existing courses only) -->
                    <div v-if="!editing.isCreate" class="pd-grant">
                        <span class="pd-money__h">Ученики курса</span>
                        <p class="pd-hint">Кто имеет доступ (куплен / выдан / оформлен, но не оплачен). Ниже можно открыть курс любому бесплатно.</p>
                        <div class="pd-grant__search">
                            <div class="pd-search pd-search--full">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                                <input v-model="grantSearch" type="search" placeholder="Найти пользователя по имени или email" @input="searchGrantUsers" />
                            </div>
                            <ul v-if="grantResults.length" class="pd-grant__res">
                                <li v-for="u in grantResults" :key="u.id">
                                    <span class="pd-grant__u">
                                        <img v-if="u.Photo" :src="u.Photo" :alt="u.Name" class="pd-grant__ava" />
                                        <span v-else class="pd-grant__ava pd-grant__ava--i">{{ initials(u.Name) }}</span>
                                        <span class="pd-grant__name">{{ u.Name || 'Без имени' }}<em>{{ u.email }}</em></span>
                                    </span>
                                    <button type="button" class="pd-btn pd-btn--sm" :disabled="grantBusyId === u.id" @click="grantAccess(u)">{{ grantBusyId === u.id ? '…' : 'Выдать' }}</button>
                                </li>
                            </ul>
                            <p v-else-if="grantSearch.trim().length >= 2 && !grantSearching" class="pd-hint">Никого не найдено.</p>
                        </div>

                        <p v-if="granteesLoading" class="pd-hint">Загрузка…</p>
                        <template v-else-if="grantees.length">
                            <p class="pd-hint">{{ granteesTotal }} {{ plural(granteesTotal, ['ученик', 'ученика', 'учеников']) }} с доступом<span v-if="granteesTotal > grantees.length"> · показаны первые {{ grantees.length }}</span></p>
                            <ul class="pd-grant__list">
                                <li v-for="g in grantees" :key="g.ucId" class="pd-grant__row">
                                    <span class="pd-grant__u">
                                        <img v-if="g.Photo" :src="g.Photo" :alt="g.Name" class="pd-grant__ava" />
                                        <span v-else class="pd-grant__ava pd-grant__ava--i">{{ initials(g.Name) }}</span>
                                        <span class="pd-grant__name">
                                            {{ g.Name || g.email || 'Пользователь' }}
                                            <em>
                                                <span class="pd-grant__tag" :class="`pd-grant__tag--${g.kind}`">{{ g.kind === 'buy' ? 'Куплен' : (g.kind === 'free' ? 'Выдан' : 'Не оплачен') }}</span>
                                                {{ g.end_period ? '· до ' + fmtDate(g.end_period) : '· бессрочно' }}
                                            </em>
                                        </span>
                                    </span>
                                    <span class="pd-grant__act">
                                        <a class="pd-iconbtn" :href="`/chats?user=${g.id}`" target="_blank" rel="noopener noreferrer" aria-label="Написать"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></a>
                                        <button v-if="g.kind !== 'buy'" type="button" class="pd-iconbtn pd-iconbtn--del" :disabled="grantBusyId === g.id" aria-label="Убрать доступ" @click="revokeAccess(g)"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></button>
                                    </span>
                                </li>
                            </ul>
                        </template>
                        <p v-else class="pd-hint">Пока ни у кого нет доступа к курсу.</p>
                        <p v-if="grantError" class="pd-formerr pd-formerr--inline">{{ grantError }}</p>
                    </div>
                </div>

                <p v-if="editing && form && formError" class="pd-formerr">{{ formError }}</p>

                <div class="pd-dialog__foot">
                    <button v-if="!editing.isCreate" type="button" class="pd-btn pd-btn--danger" :disabled="!form" @click="confirmDelete = true">Удалить курс</button>
                    <span class="pd-spacer"></span>
                    <button type="button" class="pd-btn pd-btn--ghost" @click="closeModal">Отменить</button>
                    <button type="button" class="pd-btn" :disabled="saving || !form || !form.Title.trim() || !editable" @click="saveCourse">{{ saving ? 'Сохраняем…' : 'Сохранить' }}</button>
                </div>

                <!-- delete confirm overlay -->
                <div v-if="confirmDelete" class="pd-confirm">
                    <div class="pd-confirm__box">
                        <p class="pd-confirm__t">Удалить курс «{{ form.Title || 'без названия' }}»?</p>
                        <p class="pd-confirm__d">Действие необратимо. Уроки курса останутся в базе, но курс исчезнет из каталога.</p>
                        <div class="pd-confirm__foot">
                            <button type="button" class="pd-btn pd-btn--ghost" @click="confirmDelete = false">Отмена</button>
                            <button type="button" class="pd-btn pd-btn--danger" :disabled="deleting" @click="deleteCourse">{{ deleting ? 'Удаляем…' : 'Удалить' }}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- lesson editor (nested; title / description / material — video is Phase 4) -->
        <div v-if="lessonEditing && lessonForm" class="pd-modal pd-modal--top" @click.self="closeLessonEdit">
            <div class="pd-dialog pd-dialog--sm" role="dialog" aria-modal="true">
                <div class="pd-dialog__head">
                    <h2 class="pd-dialog__title">Урок</h2>
                    <button type="button" class="pd-x" aria-label="Закрыть" @click="closeLessonEdit">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                </div>
                <div class="pd-dialog__body">
                    <label class="pd-field">
                        <span class="pd-field__lb">Название урока</span>
                        <input v-model="lessonForm.Title" type="text" class="pd-input" placeholder="Название урока" maxlength="300" />
                    </label>
                    <label class="pd-field">
                        <span class="pd-field__lb">Описание</span>
                        <textarea v-model="lessonForm.Descr" class="pd-input pd-textarea" rows="3" placeholder="Что в этом уроке" maxlength="4000"></textarea>
                    </label>

                    <div class="pd-field">
                        <span class="pd-field__lb">Материал <em class="pd-opt">pdf, docx, pptx…</em></span>
                        <div v-if="lessonEditing.File" class="pd-matrow">
                            <a class="pd-matrow__link" :href="lessonEditing.File" target="_blank" rel="noopener noreferrer">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                                {{ materialName(lessonEditing.File) }}
                            </a>
                            <button type="button" class="pd-iconbtn pd-iconbtn--del" :disabled="materialBusy" aria-label="Удалить материал" @click="removeMaterial(lessonEditing)"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></button>
                        </div>
                        <label class="pd-btn pd-btn--ghost pd-btn--sm pd-upl">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg>
                            {{ materialBusy ? 'Загрузка…' : (lessonEditing.File ? 'Заменить файл' : 'Загрузить файл') }}
                            <input type="file" class="pd-hidden-file" :disabled="materialBusy" @change="uploadMaterial($event, lessonEditing)" />
                        </label>
                    </div>

                    <div class="pd-field">
                        <span class="pd-field__lb">Видео урока</span>
                        <div v-if="videoUploading && videoTarget === 'lesson'" class="pd-vprog">
                            <div class="pd-vprog__bar"><span :style="{ transform: `scaleX(${videoProgress / 100})` }"></span></div>
                            <span class="pd-vprog__t">Загрузка… {{ videoProgress }}%</span>
                        </div>
                        <template v-else-if="lessonEditing.video_id">
                            <div class="pd-vframe"><iframe :src="embedUrl(lessonEditing.video_id, { autoplay: false })" title="Видео урока" frameborder="0" allowfullscreen allow="fullscreen; picture-in-picture"></iframe></div>
                            <div class="pd-vactions">
                                <label class="pd-btn pd-btn--ghost pd-btn--sm pd-upl">
                                    <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg> Заменить
                                    <input type="file" accept="video/*" class="pd-hidden-file" :disabled="videoUploading" @change="onLessonVideo" />
                                </label>
                                <button type="button" class="pd-btn pd-btn--dangerghost pd-btn--sm" :disabled="videoBusy" @click="removeLessonVideo">{{ videoBusy ? 'Удаляем…' : 'Удалить' }}</button>
                            </div>
                        </template>
                        <div v-else-if="lessonEditing.resume_video_id" class="pd-vresume">
                            <p class="pd-hint">Загрузка «{{ lessonEditing.resume_name || 'видео' }}» не завершена. Выберите тот же файл, чтобы продолжить.</p>
                            <label class="pd-btn pd-btn--sm pd-upl">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg> Продолжить загрузку
                                <input type="file" accept="video/*" class="pd-hidden-file" @change="onLessonVideo" />
                            </label>
                        </div>
                        <label v-else class="pd-btn pd-btn--ghost pd-btn--sm pd-upl">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg> Загрузить видео
                            <input type="file" accept="video/*" class="pd-hidden-file" @change="onLessonVideo" />
                        </label>
                    </div>

                    <!-- per-lesson ban: users here are hidden from this lesson in the viewer -->
                    <div class="pd-grant">
                        <span class="pd-field__lb">Забаненные ученики</span>
                        <p class="pd-hint">Забаненный не увидит этот урок (доступ к остальным сохраняется).</p>
                        <div class="pd-grant__search">
                            <div class="pd-search pd-search--full">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                                <input v-model="banSearch" type="search" placeholder="Найти пользователя по имени или email" @input="searchBanUsers" />
                            </div>
                            <ul v-if="banResults.length" class="pd-grant__res">
                                <li v-for="u in banResults" :key="u.id">
                                    <span class="pd-grant__u">
                                        <img v-if="u.Photo" :src="u.Photo" :alt="u.Name" class="pd-grant__ava" />
                                        <span v-else class="pd-grant__ava pd-grant__ava--i">{{ initials(u.Name) }}</span>
                                        <span class="pd-grant__name">{{ u.Name || 'Без имени' }}<em>{{ u.email }}</em></span>
                                    </span>
                                    <button type="button" class="pd-btn pd-btn--sm pd-btn--dangerghost" :disabled="banBusyId === u.id" @click="banUser(u)">{{ banBusyId === u.id ? '…' : 'Забанить' }}</button>
                                </li>
                            </ul>
                            <p v-else-if="banSearch.trim().length >= 2 && !banSearching" class="pd-hint">Никого не найдено.</p>
                        </div>
                        <p v-if="bannedLoading" class="pd-hint">Загрузка…</p>
                        <ul v-else-if="banned.length" class="pd-grant__list">
                            <li v-for="b in banned" :key="b.id" class="pd-grant__row">
                                <span class="pd-grant__u">
                                    <img v-if="b.Photo" :src="b.Photo" :alt="b.Name" class="pd-grant__ava" />
                                    <span v-else class="pd-grant__ava pd-grant__ava--i">{{ initials(b.Name) }}</span>
                                    <span class="pd-grant__name">{{ b.Name || b.email || 'Пользователь' }}<em>{{ b.email }}</em></span>
                                </span>
                                <button type="button" class="pd-btn pd-btn--ghost pd-btn--sm" :disabled="banBusyId === b.id" @click="unbanUser(b)">{{ banBusyId === b.id ? '…' : 'Разбанить' }}</button>
                            </li>
                        </ul>
                        <p v-if="banError" class="pd-formerr pd-formerr--inline">{{ banError }}</p>
                    </div>
                </div>
                <p v-if="lessonError" class="pd-formerr">{{ lessonError }}</p>
                <p v-if="videoError && videoTarget !== 'course'" class="pd-formerr">{{ videoError }}</p>
                <div class="pd-dialog__foot">
                    <span class="pd-spacer"></span>
                    <button type="button" class="pd-btn pd-btn--ghost" @click="closeLessonEdit">Закрыть</button>
                    <button type="button" class="pd-btn" :disabled="lessonSaving" @click="saveLessonMeta">{{ lessonSaving ? 'Сохраняем…' : 'Сохранить' }}</button>
                </div>
            </div>
        </div>

        <!-- folders management modal -->
        <div v-if="foldersOpen" class="pd-modal" @click.self="foldersOpen = false">
            <div class="pd-dialog pd-dialog--sm" role="dialog" aria-modal="true">
                <div class="pd-dialog__head">
                    <h2 class="pd-dialog__title">Папки</h2>
                    <button type="button" class="pd-x" aria-label="Закрыть" @click="foldersOpen = false">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                </div>
                <div class="pd-dialog__body">
                    <div class="pd-newfolder">
                        <input v-model="newFolder" type="text" class="pd-input" placeholder="Новая папка" maxlength="80" @keydown.enter="createFolder" />
                        <button type="button" class="pd-btn" :disabled="folderBusy || !newFolder.trim()" @click="createFolder">Добавить</button>
                    </div>
                    <ul v-if="folders.length" class="pd-flist">
                        <li v-for="f in folders" :key="f.id" class="pd-frow">
                            <span class="pd-frow__t"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>{{ f.title }} <em>{{ folderCount(f.id) }}</em></span>
                            <button type="button" class="pd-frow__del" :disabled="folderBusy" aria-label="Удалить папку" @click="deleteFolder(f.id)">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
                            </button>
                        </li>
                    </ul>
                    <p v-else class="pd-hint">Папок пока нет.</p>
                </div>
            </div>
        </div>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { getSupabase, readStoredSession, authCookieUser, loadUser } from '@/_front/chrome/headerAccount.js';
import { getUploadToken, uploadVideo, fetchVideoSize, PEERTUBE_ORIGIN } from '@/_front/streams/peertubeUpload.js';
import { deleteLive, embedUrl } from '@/_front/streams/peertubeLive.js';

const CREATORS = ['Спикер', 'Учебное заведение', 'admin'];

let sb = null;
const myId = ref(null);
const loading = ref(true);
const ready = ref(false);
const courses = ref([]);
const folders = ref([]);
const search = ref('');
const filter = ref('all'); // 'all' | 'discount' | 'fix' | <folder id>

// ── bulk discounts (sales): select paid courses, apply/remove a % off via Price/old_price. Works on
// published courses too (separate from the per-course edit-lock — a sale doesn't require unpublishing). ──
const discountMode = ref(false);
const selected = ref(new Set());
const discountPercent = ref(20);
const discountBusy = ref(false);
const discountError = ref('');
const discountConfirm = ref(null); // 'apply' | 'remove' | null

// ── Phase 1: metadata create / edit / delete (no money) ──────────────────────
const CATEGORIES = ['Запись семинара', 'Онлайн-курс'];
const DURATIONS = [{ v: 0, label: 'Бессрочный' }, { v: 6, label: '6 мес.' }, { v: 12, label: '12 мес.' }];
// A course's content (text, price, lessons, videos, materials, cover) is editable only in these statuses
// (WeWeb's status.weigth == 'edit'). Опубликовано / На модерации lock editing — unpublish first to edit.
const EDITABLE_STATUSES = ['Черновик', 'Отправлено на доработку', 'Снято с публикации'];
const editing = ref(null);         // the course being edited, or { isCreate: true }
const form = ref(null);            // { Title, Category, Decription, WhatTeach, For, folder }
const formLoading = ref(false);
const justCreated = ref(false);    // show the "course created — now add lessons" hint after a create
const saving = ref(false);
const deleting = ref(false);
const confirmDelete = ref(false);
const formError = ref('');
const foldersOpen = ref(false);    // folders-management modal
const newFolder = ref('');
const folderBusy = ref(false);

// ── Phase 3: lessons (title / description / material file; video is Phase 4) ──
const BUCKET = 'profile';
const STORAGE_URL = 'https://sb.meetgu.ru/storage/v1/object/public/profile//';
const lessons = ref([]);           // lessons of the course being edited, in Less_Id order
const lessonsLoading = ref(false);
const lessonEditing = ref(null);   // the lesson open in the nested editor, or { isNew: true }
const lessonForm = ref(null);      // { Title, Descr }
const lessonSaving = ref(false);
const materialBusy = ref(false);
const lessonError = ref('');
const lessonBusyId = ref(null);    // row-level spinner (reorder/delete)

// ── Phase 4: PeerTube video (lesson video + course teaser) ──
const videoUploading = ref(false); // true while a chunked upload runs (blocks a second one)
const videoProgress = ref(0);
const videoTarget = ref(null);     // 'lesson' | 'course' — which surface the progress bar belongs to
const videoBusy = ref(false);      // delete/replace
const videoError = ref('');
const coverBusy = ref(false);      // course cover image upload/remove

// ── Phase 5: manual access grant (Ученики курса) ──
const grantees = ref([]);          // students with a manual (Free) grant to the course being edited
const granteesLoading = ref(false);
const grantSearch = ref('');
const grantResults = ref([]);
const grantSearching = ref(false);
const grantBusyId = ref(null);     // per-row spinner (grant/revoke)
const grantError = ref('');

// ── Phase 5: per-lesson ban (lessons.ban_list; enforced by the redesigned MyCoursePage viewer) ──
const banned = ref([]);            // resolved users banned from the lesson being edited
const bannedLoading = ref(false);
const banSearch = ref('');
const banResults = ref([]);
const banSearching = ref(false);
const banBusyId = ref(null);
const banError = ref('');

const STATUS = {
    'Опубликовано': { label: 'Опубликовано', cls: 'live' },
    'Черновик': { label: 'Черновик', cls: 'draft' },
    'Снято с публикации': { label: 'Снято с публикации', cls: 'off' },
    'Отправлено на доработку': { label: 'На доработку', cls: 'fix' },
    'Отправлено на модерацию': { label: 'На модерации', cls: 'mod' },
};
function statusMeta(s) { return STATUS[s] || { label: s || 'Черновик', cls: 'draft' }; }

function num(v) { return Number(v || 0); }
function initials(name) {
    const p = (name || '').split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}
function fmtDate(d) {
    try { return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return ''; }
}
function lessonCount(c) { return Array.isArray(c.Less_Id) ? c.Less_Id.length : 0; }
function hasDiscount(c) { return !c.Free && num(c.old_price) > num(c.Price) && num(c.Price) > 0; }
function needsFix(c) {
    return c.ModStatus === 'Отправлено на доработку'
        || !!(c.Edit_Comment && String(c.Edit_Comment).trim())
        || !!(c.Edit_Lessons_Comment && String(c.Edit_Lessons_Comment).trim());
}
function modNote(c) {
    return (c.Edit_Comment && String(c.Edit_Comment).trim())
        || (c.Edit_Lessons_Comment && String(c.Edit_Lessons_Comment).trim())
        || '';
}
function priceLabel(c) {
    if (c.Free) return 'Бесплатно';
    const p = num(c.Price);
    return p ? `${p.toLocaleString('ru-RU')} ₽` : 'Цена не указана';
}
// Access duration (DurationLong is in MONTHS; 0 = lifetime). Only meaningful for paid courses —
// free courses are always accessible, so we don't show a period for them.
function durationLabel(c) {
    if (c.Free) return '';
    const d = num(c.DurationLong);
    return d ? `${d} мес.` : 'Бессрочный';
}
function folderTitle(id) { return id ? (folders.value.find((f) => f.id === id)?.title || '') : ''; }
function folderCount(id) { return courses.value.filter((c) => c.folder === id).length; }
function plural(n, [one, few, many]) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}

const discountCount = computed(() => courses.value.filter(hasDiscount).length);
const fixCount = computed(() => courses.value.filter(needsFix).length);
// content editable? (new course, or a status with weigth=='edit'). Grants/bans/moderation stay allowed.
const editable = computed(() => !!editing.value && (editing.value.isCreate || EDITABLE_STATUSES.includes(editing.value.ModStatus)));

const visible = computed(() => {
    let list = courses.value;
    if (filter.value === 'discount') list = list.filter(hasDiscount);
    else if (filter.value === 'fix') list = list.filter(needsFix);
    else if (filter.value !== 'all') list = list.filter((c) => c.folder === filter.value);
    const q = search.value.trim().toLowerCase();
    if (q) list = list.filter((c) => (c.Title || '').toLowerCase().includes(q));
    return list;
});

const COLS = 'id, "Title", "Free", "Price", old_price, "DurationPrice", "DurationLong", "Buy", "ModStatus", "Less_Id", folder, video_id, slug, "Edit_Comment", "Edit_Lessons_Comment", created_at';

async function load() {
    sb = getSupabase();
    myId.value = readStoredSession()?.user?.id || authCookieUser()?.id || null;
    if (!myId.value) { window.location.href = '/login'; return; }
    if (!sb) { loading.value = false; return; }

    // creator-only gate (mirrors the header nav)
    const me = await loadUser(sb);
    if (!me || !CREATORS.includes(me.role)) { window.location.href = '/'; return; }

    // Heal the shared PeerTube token on open — this page is the platform's token bootstrap (streams
    // depend on it; the token has expired in practice). Fire-and-forget; upload also heals lazily.
    getUploadToken(sb).catch(() => { /* healed lazily on first upload otherwise */ });

    const [{ data: cs }, { data: fs }] = await Promise.all([
        sb.from('course').select(COLS).eq('owner', myId.value).order('created_at', { ascending: false }).limit(2000),
        sb.from('course_folders').select('id, title, priority').eq('creator', myId.value).order('priority', { ascending: true }),
    ]);
    courses.value = cs || [];
    folders.value = fs || [];

    loading.value = false;
    await nextTick();
    ready.value = true;
}

// ── slug (Cyrillic → url-safe latin), mirrors the site's existing course slugs ──
const TRANSLIT = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .split('').map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch)).join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'kurs';
}
// Ensure the slug is unique across `course` (append -2, -3… on collision).
async function uniqueSlug(base, excludeId) {
    let slug = base, n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        let q = sb.from('course').select('id').eq('slug', slug).limit(1);
        if (excludeId) q = q.neq('id', excludeId);
        const { data } = await q;
        if (!data || !data.length) return slug;
        n += 1; slug = `${base}-${n}`;
    }
}

function openCreate() {
    editing.value = { isCreate: true };
    form.value = {
        Title: '', Category: CATEGORIES[0], Decription: '', WhatTeach: '', For: '', folder: null,
        Free: false, Price: 0, old_price: 0, DurationLong: 0, DurationPrice: 0, Buy: true,
    };
    confirmDelete.value = false; formError.value = ''; justCreated.value = false;
}
async function openEdit(c) {
    editing.value = c;
    form.value = null; confirmDelete.value = false; formError.value = ''; justCreated.value = false;
    lessons.value = []; lessonEditing.value = null; lessonError.value = '';
    grantees.value = []; grantResults.value = []; grantSearch.value = ''; grantError.value = '';
    loadLessons(c);
    loadGrantees(c);
    // the list rows are lightweight (COLS) and don't carry the long text fields — fetch them fresh
    // so the editor shows the true Category/Decription/WhatTeach/For and can't blank them on save.
    formLoading.value = true;
    try {
        const { data } = await sb.from('course')
            .select('"Title", "Category", "Decription", "WhatTeach", "For", folder, "Free", "Price", old_price, "DurationLong", "DurationPrice", "Buy", video_id, video_size, resume_video_id, resume_chunk, resume_name, cover')
            .eq('id', c.id).limit(1);
        const full = data?.[0] || {};
        // merge the teaser video + resume state + cover onto `editing` so those sections can read them
        editing.value = { ...editing.value, video_id: full.video_id, video_size: full.video_size,
            resume_video_id: full.resume_video_id, resume_chunk: full.resume_chunk, resume_name: full.resume_name, cover: full.cover };
        form.value = {
            Title: full.Title ?? c.Title ?? '', Category: full.Category || CATEGORIES[0],
            Decription: full.Decription || '', WhatTeach: full.WhatTeach || '', For: full.For || '', folder: full.folder || null,
            Free: !!full.Free, Price: num(full.Price), old_price: num(full.old_price),
            DurationLong: num(full.DurationLong), DurationPrice: num(full.DurationPrice), Buy: full.Buy !== false,
        };
    } catch (e) {
        formError.value = 'Не удалось загрузить курс.';
        form.value = { Title: c.Title || '', Category: CATEGORIES[0], Decription: '', WhatTeach: '', For: '', folder: c.folder || null,
            Free: !!c.Free, Price: num(c.Price), old_price: num(c.old_price), DurationLong: num(c.DurationLong), DurationPrice: num(c.DurationPrice), Buy: true };
    } finally {
        formLoading.value = false;
    }
}
function closeModal() { editing.value = null; form.value = null; justCreated.value = false; }

async function saveCourse() {
    if (saving.value || !form.value || !editable.value) return;
    const title = form.value.Title.trim();
    if (!title) { formError.value = 'Введите название курса.'; return; }
    saving.value = true; formError.value = '';
    try {
        const isCreate = !!editing.value.isCreate;
        const slug = await uniqueSlug(slugify(title), isCreate ? null : editing.value.id);
        // money normalization: a free course carries no price; a lifetime course carries no renewal price.
        const free = !!form.value.Free;
        const durLong = num(form.value.DurationLong);
        const fields = {
            Title: title,
            Category: form.value.Category,
            Decription: form.value.Decription.trim(),
            WhatTeach: form.value.WhatTeach.trim(),
            For: form.value.For.trim(),
            folder: form.value.folder || null,
            slug,
            Free: free,
            Price: free ? 0 : num(form.value.Price),
            old_price: free ? 0 : num(form.value.old_price),
            DurationLong: free ? 0 : durLong,
            DurationPrice: free || durLong === 0 ? 0 : num(form.value.DurationPrice),
            Buy: free ? false : !!form.value.Buy,
        };
        if (isCreate) {
            // new courses always start as an unpublished draft; moderation is a separate action.
            const { data, error } = await sb.from('course')
                .insert({ ...fields, owner: myId.value, ModStatus: 'Черновик' })
                .select(COLS).limit(1);
            if (error) throw error;
            const row = data?.[0];
            if (row) courses.value = [row, ...courses.value];
            await appendUserCourse(row?.id);
            // Don't close: re-open the freshly created course in EDIT mode so the author can add lessons
            // right away (lessons need a course id, so they can't exist during the create step). openEdit
            // resets justCreated, so raise the hint afterwards.
            if (row) {
                await openEdit(row);
                justCreated.value = true;
            } else {
                closeModal();
            }
            return;
        } else {
            // NB: self-hosted PostgREST rejects UPDATE .select().limit() with no .order() (PGRST109)
            // and rolls the whole mutation back — so no .limit() here (eq('id') already matches one row).
            const { data, error } = await sb.from('course').update(fields).eq('id', editing.value.id).select(COLS);
            if (error) throw error;
            const row = data?.[0];
            if (row) courses.value = courses.value.map((c) => (c.id === row.id ? row : c));
        }
        closeModal();
    } catch (e) {
        formError.value = `Не удалось сохранить: ${e?.message || 'ошибка'}`;
    } finally {
        saving.value = false;
    }
}

// ── moderation (creator side) ────────────────────────────────────────────────
// The creator can submit a course for moderation, withdraw it, or unpublish a live course.
// Only an admin (superadmin) sets «Опубликовано» — the creator never self-publishes.
const statusBusy = ref(false);
function nextStatusAction() {
    if (!editing.value || editing.value.isCreate) return null;
    switch (editing.value.ModStatus) {
        case 'Опубликовано': return { to: 'Снято с публикации', label: 'Снять с публикации', danger: true };
        case 'Отправлено на модерацию': return { to: 'Черновик', label: 'Отозвать с модерации', danger: false };
        default: return { to: 'Отправлено на модерацию', label: 'Отправить на модерацию', danger: false }; // Черновик / Снято / Доработка
    }
}
async function setStatus(to) {
    if (statusBusy.value || !editing.value || editing.value.isCreate) return;
    statusBusy.value = true; formError.value = '';
    try {
        const id = editing.value.id;
        // no .limit() — see the PGRST109 note in saveCourse
        const { data, error } = await sb.from('course').update({ ModStatus: to }).eq('id', id).select(COLS);
        if (error) throw error;
        const row = data?.[0];
        if (row) {
            courses.value = courses.value.map((c) => (c.id === row.id ? row : c));
            editing.value = { ...editing.value, ModStatus: to };
        }
    } catch (e) {
        formError.value = `Не удалось изменить статус: ${e?.message || 'ошибка'}`;
    } finally {
        statusBusy.value = false;
    }
}

async function deleteCourse() {
    if (deleting.value || editing.value?.isCreate) return;
    deleting.value = true; formError.value = '';
    try {
        const id = editing.value.id;
        const { error } = await sb.from('course').delete().eq('id', id);
        if (error) throw error;
        courses.value = courses.value.filter((c) => c.id !== id);
        await removeUserCourse(id);
        closeModal();
    } catch (e) {
        formError.value = `Не удалось удалить: ${e?.message || 'ошибка'}`;
    } finally {
        deleting.value = false; confirmDelete.value = false;
    }
}

// keep the legacy users.courses array in sync (secondary list; the real list is course.owner)
async function appendUserCourse(courseId) {
    if (!courseId) return;
    const { data } = await sb.from('users').select('courses').eq('id', myId.value).limit(1);
    const arr = Array.isArray(data?.[0]?.courses) ? data[0].courses : [];
    if (!arr.includes(courseId)) await sb.from('users').update({ courses: [...arr, courseId] }).eq('id', myId.value);
}
async function removeUserCourse(courseId) {
    const { data } = await sb.from('users').select('courses').eq('id', myId.value).limit(1);
    const arr = Array.isArray(data?.[0]?.courses) ? data[0].courses : [];
    if (arr.includes(courseId)) await sb.from('users').update({ courses: arr.filter((x) => x !== courseId) }).eq('id', myId.value);
}

// ── folders ──────────────────────────────────────────────────────────────────
// Assigning a course to a folder is organizational metadata, NOT locked content: it stays editable in
// every status (published / on moderation included). Persists just the `folder` column immediately,
// bypassing the edit-lock (like bulk discounts do). For a not-yet-created course it's a no-op — the
// folder rides along in the insert (saveCourse `fields`).
async function assignFolder() {
    if (!editing.value || editing.value.isCreate || !form.value) return;
    const id = editing.value.id;
    const folder = form.value.folder || null;
    try {
        // no .limit() — PGRST109 (see the note in saveCourse)
        const { error } = await sb.from('course').update({ folder }).eq('id', id);
        if (error) throw error;
        courses.value = courses.value.map((c) => (c.id === id ? { ...c, folder } : c));
        editing.value = { ...editing.value, folder };
    } catch (e) {
        formError.value = `Не удалось сменить папку: ${e?.message || 'ошибка'}`;
    }
}
async function createFolder() {
    const title = newFolder.value.trim();
    if (!title || folderBusy.value) return;
    folderBusy.value = true;
    try {
        const priority = (folders.value.reduce((m, f) => Math.max(m, num(f.priority)), 0)) + 1;
        const { data, error } = await sb.from('course_folders')
            .insert({ title, creator: myId.value, priority }).select('id, title, priority').limit(1);
        if (error) throw error;
        if (data?.[0]) folders.value = [...folders.value, data[0]];
        newFolder.value = '';
    } catch (e) { /* surfaced by the disabled state; keep simple */ }
    finally { folderBusy.value = false; }
}
async function deleteFolder(id) {
    if (folderBusy.value) return;
    folderBusy.value = true;
    try {
        // clear the folder ref on any of this creator's courses first, then drop the folder
        await sb.from('course').update({ folder: null }).eq('folder', id).eq('owner', myId.value);
        const { error } = await sb.from('course_folders').delete().eq('id', id);
        if (error) throw error;
        folders.value = folders.value.filter((f) => f.id !== id);
        courses.value = courses.value.map((c) => (c.folder === id ? { ...c, folder: null } : c));
        if (filter.value === id) filter.value = 'all';
    } catch (e) { /* keep simple */ }
    finally { folderBusy.value = false; }
}

// ── lessons ──────────────────────────────────────────────────────────────────
// Sync a course's lesson order everywhere: the course.Less_Id column + the list card + the open editor.
async function writeLessId(courseId, ids) {
    await sb.from('course').update({ Less_Id: ids }).eq('id', courseId);
    courses.value = courses.value.map((c) => (c.id === courseId ? { ...c, Less_Id: ids } : c));
    if (editing.value && editing.value.id === courseId) editing.value = { ...editing.value, Less_Id: ids };
}
async function loadLessons(c) {
    if (!c || c.isCreate) return;
    lessonsLoading.value = true;
    try {
        const ids = Array.isArray(c.Less_Id) ? c.Less_Id : [];
        if (!ids.length) { lessons.value = []; return; }
        const { data } = await sb.from('lessons').select('id, "Title", "Descr", "File", video_id, video_size, resume_video_id, resume_chunk, resume_name, ban_list').in('id', ids);
        const byId = Object.fromEntries((data || []).map((l) => [l.id, l]));
        lessons.value = ids.map((id) => byId[id]).filter(Boolean); // keep Less_Id order
    } catch (e) { lessonError.value = 'Не удалось загрузить уроки.'; }
    finally { lessonsLoading.value = false; }
}
async function addLesson() {
    if (!editing.value || editing.value.isCreate || lessonSaving.value || !editable.value) return;
    lessonError.value = '';
    try {
        const n = lessons.value.length + 1;
        const { data, error } = await sb.from('lessons')
            .insert({ Title: `Новый урок ${n}`, Course: editing.value.id }).select('id, "Title", "Descr", "File", video_id');
        if (error) throw error;
        const row = data?.[0];
        if (!row) return;
        lessons.value = [...lessons.value, row];
        await writeLessId(editing.value.id, lessons.value.map((l) => l.id));
        openLessonEdit(row);
    } catch (e) { lessonError.value = `Не удалось добавить урок: ${e?.message || 'ошибка'}`; }
}
function openLessonEdit(lesson) {
    lessonEditing.value = lesson;
    lessonForm.value = { Title: lesson.Title || '', Descr: lesson.Descr || '' };
    lessonError.value = '';
    loadLessonBans(lesson);
}
function closeLessonEdit() { lessonEditing.value = null; lessonForm.value = null; banned.value = []; banResults.value = []; banSearch.value = ''; }
async function saveLessonMeta() {
    if (!lessonEditing.value || lessonSaving.value || !lessonForm.value || !editable.value) return;
    lessonSaving.value = true; lessonError.value = '';
    try {
        const id = lessonEditing.value.id;
        const fields = { Title: lessonForm.value.Title.trim() || 'Без названия', Descr: lessonForm.value.Descr.trim() };
        const { data, error } = await sb.from('lessons').update(fields).eq('id', id).select('id, "Title", "Descr", "File", video_id'); // no .limit (PGRST109)
        if (error) throw error;
        const row = data?.[0];
        if (row) lessons.value = lessons.value.map((l) => (l.id === id ? row : l));
        closeLessonEdit();
    } catch (e) { lessonError.value = `Не удалось сохранить урок: ${e?.message || 'ошибка'}`; }
    finally { lessonSaving.value = false; }
}
async function deleteLesson(lesson) {
    if (lessonBusyId.value || !editable.value) return;
    lessonBusyId.value = lesson.id; lessonError.value = '';
    try {
        // remove the material object too, if any (best-effort)
        if (lesson.File) { try { await sb.storage.from(BUCKET).remove([lesson.File.split('/').pop()]); } catch (_) { /* ignore */ } }
        const { error } = await sb.from('lessons').delete().eq('id', lesson.id);
        if (error) throw error;
        lessons.value = lessons.value.filter((l) => l.id !== lesson.id);
        await writeLessId(editing.value.id, lessons.value.map((l) => l.id));
        if (lessonEditing.value?.id === lesson.id) closeLessonEdit();
    } catch (e) { lessonError.value = `Не удалось удалить урок: ${e?.message || 'ошибка'}`; }
    finally { lessonBusyId.value = null; }
}
async function moveLesson(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= lessons.value.length || lessonBusyId.value || !editable.value) return;
    const arr = lessons.value.slice();
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    lessons.value = arr;
    lessonBusyId.value = arr[j].id;
    try { await writeLessId(editing.value.id, arr.map((l) => l.id)); }
    finally { lessonBusyId.value = null; }
}
async function uploadMaterial(e, lesson) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || materialBusy.value || !editable.value) return;
    materialBusy.value = true; lessonError.value = '';
    try {
        if (lesson.File) { try { await sb.storage.from(BUCKET).remove([lesson.File.split('/').pop()]); } catch (_) { /* ignore */ } }
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await sb.storage.from(BUCKET).upload(key, file, { upsert: false });
        if (upErr) throw upErr;
        const url = STORAGE_URL + key;
        const { error } = await sb.from('lessons').update({ File: url }).eq('id', lesson.id);
        if (error) throw error;
        lessons.value = lessons.value.map((l) => (l.id === lesson.id ? { ...l, File: url } : l));
        if (lessonEditing.value?.id === lesson.id) lessonEditing.value = { ...lessonEditing.value, File: url };
    } catch (e2) { lessonError.value = 'Не удалось загрузить материал.'; }
    finally { materialBusy.value = false; }
}
async function removeMaterial(lesson) {
    if (materialBusy.value || !lesson.File || !editable.value) return;
    materialBusy.value = true; lessonError.value = '';
    try {
        try { await sb.storage.from(BUCKET).remove([lesson.File.split('/').pop()]); } catch (_) { /* ignore */ }
        const { error } = await sb.from('lessons').update({ File: '' }).eq('id', lesson.id);
        if (error) throw error;
        lessons.value = lessons.value.map((l) => (l.id === lesson.id ? { ...l, File: '' } : l));
        if (lessonEditing.value?.id === lesson.id) lessonEditing.value = { ...lessonEditing.value, File: '' };
    } catch (e) { lessonError.value = 'Не удалось удалить материал.'; }
    finally { materialBusy.value = false; }
}
function materialName(url) { return url ? decodeURIComponent(url.split('/').pop() || 'файл') : ''; }

// ── video (lessons.video_id / course.video_id via the shared PeerTube system account) ──────────
function patchLesson(id, p) {
    lessons.value = lessons.value.map((l) => (l.id === id ? { ...l, ...p } : l));
    if (lessonEditing.value?.id === id) lessonEditing.value = { ...lessonEditing.value, ...p };
}
function patchCourse(id, p) {
    courses.value = courses.value.map((c) => (c.id === id ? { ...c, ...p } : c));
    if (editing.value?.id === id) editing.value = { ...editing.value, ...p };
}
// Chunked resumable upload; resume checkpoints are persisted to the row's resume_* columns (parity with
// the WeWeb uploader) so an interrupted upload can pick up where it stopped.
async function runVideoUpload(table, row, file, patch, which) {
    if (videoUploading.value || !editable.value) return;
    videoUploading.value = true; videoProgress.value = 0; videoTarget.value = which; videoError.value = '';
    try {
        const token = await getUploadToken(sb);
        await sb.from(table).update({ resume_name: file.name }).eq('id', row.id);
        const result = await uploadVideo({
            token, file,
            resumeUploadId: row.resume_video_id || null,
            resumeStart: row.resume_video_id ? Number(row.resume_chunk || 0) : 0,
            onInit: (uid) => sb.from(table).update({ resume_video_id: uid }).eq('id', row.id),
            onChunk: (pos) => sb.from(table).update({ resume_chunk: String(pos) }).eq('id', row.id),
            onProgress: (p) => { videoProgress.value = p; },
        });
        const size = await fetchVideoSize(result.uuid);
        const done = { video_id: result.uuid, video_size: size, resume_video_id: null, resume_chunk: null, resume_name: null };
        await sb.from(table).update(done).eq('id', row.id);
        patch(done);
    } catch (e) {
        if (e?.message !== 'cancelled') videoError.value = `Не удалось загрузить видео: ${e?.message || 'ошибка'}`;
    } finally {
        videoUploading.value = false; videoTarget.value = null;
    }
}
async function runVideoDelete(table, row, patch) {
    if (videoBusy.value || !editable.value) return;
    videoBusy.value = true; videoError.value = '';
    try {
        if (row.video_id) { try { await deleteLive(sb, row.video_id); } catch (_) { /* already gone */ } }
        const done = { video_id: null, video_size: null, resume_video_id: null, resume_chunk: null, resume_name: null };
        await sb.from(table).update(done).eq('id', row.id);
        patch(done);
    } catch (e) { videoError.value = 'Не удалось удалить видео.'; }
    finally { videoBusy.value = false; }
}
function onLessonVideo(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    const l = lessonEditing.value;
    if (f && l) runVideoUpload('lessons', l, f, (p) => patchLesson(l.id, p), 'lesson');
}
function removeLessonVideo() {
    const l = lessonEditing.value;
    if (l) runVideoDelete('lessons', l, (p) => patchLesson(l.id, p));
}
function onCourseVideo(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    const c = editing.value;
    if (f && c && !c.isCreate) runVideoUpload('course', c, f, (p) => patchCourse(c.id, p), 'course');
}
function removeCourseVideo() {
    const c = editing.value;
    if (c && !c.isCreate) runVideoDelete('course', c, (p) => patchCourse(c.id, p));
}
function videoEmbed(uuid) { return embedUrl(uuid, { autoplay: true }); }

// ── course cover image (course.cover; shown where there's no teaser + as the teaser poster) ──────
async function onCoverUpload(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    const c = editing.value;
    if (!file || !c || c.isCreate || coverBusy.value || !editable.value) return;
    coverBusy.value = true; videoError.value = '';
    try {
        if (c.cover) { try { await sb.storage.from(BUCKET).remove([c.cover.split('/').pop()]); } catch (_) { /* ignore */ } }
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await sb.storage.from(BUCKET).upload(key, file, { upsert: false });
        if (upErr) throw upErr;
        const url = STORAGE_URL + key;
        const { error } = await sb.from('course').update({ cover: url }).eq('id', c.id);
        if (error) throw error;
        patchCourse(c.id, { cover: url });
    } catch (e2) { videoError.value = 'Не удалось загрузить обложку.'; }
    finally { coverBusy.value = false; }
}
async function removeCover() {
    const c = editing.value;
    if (!c || c.isCreate || coverBusy.value || !c.cover || !editable.value) return;
    coverBusy.value = true; videoError.value = '';
    try {
        try { await sb.storage.from(BUCKET).remove([c.cover.split('/').pop()]); } catch (_) { /* ignore */ }
        const { error } = await sb.from('course').update({ cover: null }).eq('id', c.id);
        if (error) throw error;
        patchCourse(c.id, { cover: null });
    } catch (e) { videoError.value = 'Не удалось удалить обложку.'; }
    finally { coverBusy.value = false; }
}

// ── manual access grants (teacher opens their course to a specific student) ──────────────────────
// A grant is a FREE user_course row (mirrors coursesApi.enrollFree) + the student's buied_courses arrays,
// with end_period set for time-limited courses. No payment / sales / order — it's a comp.
function addMonthsIso(months) {
    const d = new Date();
    d.setMonth(d.getMonth() + Number(months || 0));
    return d.toISOString();
}
const granteesTotal = ref(0);
const GRANTEES_LIMIT = 300;
async function loadGrantees(c) {
    if (!c || c.isCreate) { grantees.value = []; granteesTotal.value = 0; return; }
    granteesLoading.value = true; grantError.value = '';
    try {
        // The whole access roster (matches the WeWeb «Ученики курса», which filtered by course only):
        // buyers (buy=true), free grants (Free=true), and buy-click-without-payment rows.
        const { data: rows, count } = await sb.from('user_course')
            .select('id, "user", "Free", buy, end_period', { count: 'exact' })
            .eq('course', c.id).order('created_at', { ascending: false }).limit(GRANTEES_LIMIT);
        granteesTotal.value = count ?? (rows?.length || 0);
        const list = rows || [];
        const ids = [...new Set(list.map((r) => r.user).filter(Boolean))];
        let byId = {};
        if (ids.length) {
            const { data: us } = await sb.from('users').select('id, "Name", email, "Photo"').in('id', ids);
            byId = Object.fromEntries((us || []).map((u) => [u.id, u]));
        }
        grantees.value = list.map((r) => ({
            ucId: r.id, end_period: r.end_period,
            kind: r.buy ? 'buy' : (r.Free ? 'free' : 'pending'),
            ...(byId[r.user] || { id: r.user, Name: 'Пользователь' }),
        }));
    } catch (e) { grantError.value = 'Не удалось загрузить список.'; }
    finally { granteesLoading.value = false; }
}
let grantSearchSeq = 0;
async function searchGrantUsers() {
    const q = grantSearch.value.trim();
    grantResults.value = [];
    if (q.length < 2) return;
    const seq = ++grantSearchSeq;
    grantSearching.value = true;
    try {
        const { data } = await sb.from('users')
            .select('id, "Name", email, "Photo"')
            .or(`Name.ilike.%${q}%,email.ilike.%${q}%`).limit(8);
        if (seq !== grantSearchSeq) return; // a newer search superseded this one
        const grantedIds = new Set(grantees.value.map((g) => g.id));
        grantResults.value = (data || []).filter((u) => u.id !== myId.value && !grantedIds.has(u.id));
    } catch (e) { /* keep silent; the list just stays empty */ }
    finally { if (seq === grantSearchSeq) grantSearching.value = false; }
}
async function grantAccess(student) {
    if (!editing.value || editing.value.isCreate || grantBusyId.value) return;
    grantBusyId.value = student.id; grantError.value = '';
    try {
        const c = editing.value;
        const dur = num(c.DurationLong);
        const end_period = dur > 0 ? addMonthsIso(dur) : null;
        const { data: ins, error } = await sb.from('user_course')
            .insert({ user: student.id, course: c.id, Free: true, end_period }).select('id');
        if (error) throw error;
        const ucId = ins?.[0]?.id;
        // append to the student's library arrays (verbatim with enrollFree)
        const { data: su } = await sb.from('users').select('buied_courses, buied_course_orig').eq('id', student.id).limit(1);
        const bc = Array.isArray(su?.[0]?.buied_courses) ? su[0].buied_courses : [];
        const bco = Array.isArray(su?.[0]?.buied_course_orig) ? su[0].buied_course_orig : [];
        await sb.from('users').update({ buied_courses: [...bc, ucId], buied_course_orig: [...bco, c.id] }).eq('id', student.id);
        grantees.value = [{ ucId, end_period, kind: 'free', ...student }, ...grantees.value];
        granteesTotal.value += 1;
        grantSearch.value = ''; grantResults.value = [];
    } catch (e) { grantError.value = `Не удалось выдать доступ: ${e?.message || 'ошибка'}`; }
    finally { grantBusyId.value = null; }
}
async function revokeAccess(g) {
    if (grantBusyId.value) return;
    grantBusyId.value = g.id; grantError.value = '';
    try {
        const c = editing.value;
        const { error } = await sb.from('user_course').delete().eq('id', g.ucId);
        if (error) throw error;
        // pull the ids back out of the student's library arrays
        const { data: su } = await sb.from('users').select('buied_courses, buied_course_orig').eq('id', g.id).limit(1);
        const bc = (su?.[0]?.buied_courses || []).filter((x) => x !== g.ucId);
        const bco = (su?.[0]?.buied_course_orig || []);
        const idx = bco.indexOf(c.id);
        if (idx >= 0) bco.splice(idx, 1); // remove one occurrence of this course
        await sb.from('users').update({ buied_courses: bc, buied_course_orig: bco }).eq('id', g.id);
        grantees.value = grantees.value.filter((x) => x.ucId !== g.ucId);
        granteesTotal.value = Math.max(0, granteesTotal.value - 1);
    } catch (e) { grantError.value = `Не удалось отозвать доступ: ${e?.message || 'ошибка'}`; }
    finally { grantBusyId.value = null; }
}

// ── per-lesson ban (writes lessons.ban_list; the viewer hides banned users' lessons) ──────────────
async function loadLessonBans(lesson) {
    banned.value = []; banResults.value = []; banSearch.value = ''; banError.value = '';
    const ids = Array.isArray(lesson?.ban_list) ? lesson.ban_list.filter(Boolean) : [];
    if (!ids.length) return;
    bannedLoading.value = true;
    try {
        const { data } = await sb.from('users').select('id, "Name", email, "Photo"').in('id', ids);
        const byId = Object.fromEntries((data || []).map((u) => [u.id, u]));
        banned.value = ids.map((id) => byId[id] || { id, Name: 'Пользователь' });
    } catch (e) { banError.value = 'Не удалось загрузить список.'; }
    finally { bannedLoading.value = false; }
}
let banSearchSeq = 0;
async function searchBanUsers() {
    const q = banSearch.value.trim();
    banResults.value = [];
    if (q.length < 2) return;
    const seq = ++banSearchSeq;
    banSearching.value = true;
    try {
        const { data } = await sb.from('users').select('id, "Name", email, "Photo"').or(`Name.ilike.%${q}%,email.ilike.%${q}%`).limit(8);
        if (seq !== banSearchSeq) return;
        const bannedIds = new Set(banned.value.map((b) => b.id));
        banResults.value = (data || []).filter((u) => u.id !== myId.value && !bannedIds.has(u.id));
    } catch (e) { /* silent */ }
    finally { if (seq === banSearchSeq) banSearching.value = false; }
}
async function banUser(student) {
    const l = lessonEditing.value;
    if (!l || banBusyId.value) return;
    banBusyId.value = student.id; banError.value = '';
    try {
        const cur = Array.isArray(l.ban_list) ? l.ban_list.filter(Boolean) : [];
        if (cur.includes(student.id)) return;
        const next = [...cur, student.id];
        const { error } = await sb.from('lessons').update({ ban_list: next }).eq('id', l.id);
        if (error) throw error;
        patchLesson(l.id, { ban_list: next });
        banned.value = [student, ...banned.value];
        banSearch.value = ''; banResults.value = [];
    } catch (e) { banError.value = `Не удалось забанить: ${e?.message || 'ошибка'}`; }
    finally { banBusyId.value = null; }
}
async function unbanUser(u) {
    const l = lessonEditing.value;
    if (!l || banBusyId.value) return;
    banBusyId.value = u.id; banError.value = '';
    try {
        const next = (Array.isArray(l.ban_list) ? l.ban_list : []).filter((x) => x !== u.id);
        const { error } = await sb.from('lessons').update({ ban_list: next }).eq('id', l.id);
        if (error) throw error;
        patchLesson(l.id, { ban_list: next });
        banned.value = banned.value.filter((x) => x.id !== u.id);
    } catch (e) { banError.value = `Не удалось разбанить: ${e?.message || 'ошибка'}`; }
    finally { banBusyId.value = null; }
}

// ── bulk discounts ───────────────────────────────────────────────────────────
function enterDiscountMode() { discountMode.value = true; selected.value = new Set(); discountError.value = ''; }
function exitDiscountMode() { discountMode.value = false; selected.value = new Set(); discountConfirm.value = null; }
function toggleSelect(id) {
    const s = new Set(selected.value);
    if (s.has(id)) s.delete(id); else s.add(id);
    selected.value = s;
}
// only PAID courses can be discounted (free courses have no price)
const discountable = computed(() => visible.value.filter((c) => !c.Free));
function selectAllVisible() { selected.value = new Set(discountable.value.map((c) => c.id)); }
function selectDiscounted() { selected.value = new Set(discountable.value.filter(hasDiscount).map((c) => c.id)); }
function clearSelection() { selected.value = new Set(); }

async function runBulk(mode) {
    if (discountBusy.value || !selected.value.size) return;
    const pct = Math.max(0, Math.min(99, num(discountPercent.value)));
    if (mode === 'apply' && pct <= 0) { discountError.value = 'Укажите процент скидки (1–99).'; return; }
    discountBusy.value = true; discountError.value = '';
    try {
        const ids = [...selected.value];
        const byId = Object.fromEntries(courses.value.map((c) => [c.id, c]));
        const jobs = ids.map((id) => {
            const c = byId[id];
            if (!c || c.Free) return null;
            let patch;
            if (mode === 'apply') {
                const base = num(c.old_price) > 0 ? num(c.old_price) : num(c.Price); // re-discount from the original
                if (base <= 0) return null;
                patch = { old_price: base, Price: Math.round(base * (1 - pct / 100)) };
            } else { // remove
                if (num(c.old_price) <= 0) return null; // nothing to restore
                patch = { Price: num(c.old_price), old_price: null };
            }
            return { id, patch };
        }).filter(Boolean);
        // apply in small concurrent batches
        for (let i = 0; i < jobs.length; i += 8) {
            const batch = jobs.slice(i, i + 8);
            // eslint-disable-next-line no-await-in-loop
            await Promise.all(batch.map((j) => sb.from('course').update(j.patch).eq('id', j.id)));
            batch.forEach((j) => patchCourse(j.id, j.patch));
        }
        discountConfirm.value = null;
        exitDiscountMode();
    } catch (e) {
        discountError.value = `Не удалось применить: ${e?.message || 'ошибка'}`;
    } finally {
        discountBusy.value = false;
    }
}

onMounted(() => { ensureFonts(); load(); });

function ensureFonts() {
    if (document.getElementById('pd-fonts')) return;
    const l = document.createElement('link');
    l.id = 'pd-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
</script>

<style scoped>
.pd {
    --bg: #ffffff; --bg-tint: #f1f6fd; --surface: #ffffff;
    --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1;
    --blue: #2e70dd; --blue-soft: #5495f3; --blue-strong: #2360c6; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe;
    --gold: #f0a641; --green: #157a38; --green-tint: #e5f4ea; --red: #de0030; --red-tint: #fdeaee;
    --orange: #c9660a; --orange-tint: #fdefe0; --grey-tint: #eef1f6;
    --r-lg: 18px; --r-md: 12px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --wrap: 1160px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 16px; line-height: 1.5; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 24px; }
.pd-ic { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
[data-reveal] { opacity: 0; transform: translateY(14px); transition: opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
.pd.is-ready [data-reveal]:nth-child(2) { transition-delay: 0.05s; }
.pd.is-ready [data-reveal]:nth-child(3) { transition-delay: 0.08s; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-section { padding: 34px 0 90px; }
.pd-section.has-salebar { padding-bottom: 130px; }
.pd-load { padding: 90px 24px; text-align: center; color: var(--ink-2); }

.pd-head { margin-bottom: 22px; }
.pd-head__row { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.pd-head__title { margin: 0; font-weight: 800; font-size: clamp(1.6rem, 3.2vw, 2.2rem); line-height: 1.1; letter-spacing: -0.025em; }
.pd-head__descr { margin: 8px 0 0; color: var(--ink-2); font-size: 1rem; max-width: 60ch; }

.pd-btn { display: inline-flex; align-items: center; gap: 8px; border: none; border-radius: var(--r-pill); background: var(--blue); color: #fff; font-family: inherit; font-weight: 700; font-size: 0.95rem; padding: 11px 22px; cursor: pointer; text-decoration: none; transition: background 0.15s var(--ease-out), transform 0.15s var(--ease-out); white-space: nowrap; }
.pd-btn .pd-ic { width: 18px; height: 18px; }
.pd-btn:disabled { opacity: 0.45; cursor: not-allowed; }
@media (hover: hover) and (pointer: fine) { .pd-btn:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-1px); } }

.pd-toolbar { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; }
.pd-search { display: flex; align-items: center; gap: 9px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 10px 16px; max-width: 420px; }
.pd-search .pd-ic { width: 18px; height: 18px; color: var(--ink-3); flex: none; }
.pd-search input { border: 0; outline: none; background: none; font-family: inherit; font-size: 0.96rem; color: var(--ink); width: 100%; }
.pd-search input::placeholder { color: var(--ink-3); }

.pd-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pd-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-pill); padding: 7px 14px; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: var(--ink-2); transition: background 0.14s var(--ease-out), border-color 0.14s, color 0.14s; }
.pd-chip__ic { width: 15px; height: 15px; }
.pd-chip__n { font-size: 0.8rem; color: var(--ink-3); font-weight: 700; }
.pd-chip.is-on { background: var(--blue); border-color: var(--blue); color: #fff; }
.pd-chip.is-on .pd-chip__n { color: rgba(255, 255, 255, 0.8); }
.pd-chip--warn { color: var(--orange); border-color: #f3d3ac; background: var(--orange-tint); }
.pd-chip--warn.is-on { background: var(--orange); border-color: var(--orange); color: #fff; }
.pd-chip--warn.is-on .pd-chip__n { color: rgba(255, 255, 255, 0.85); }
@media (hover: hover) and (pointer: fine) { .pd-chip:not(.is-on):hover { border-color: var(--blue-soft); color: var(--blue-ink); } }
.pd-chips__sep { width: 1px; align-self: stretch; background: var(--line); margin: 2px 4px; }

.pd-count { margin: 0 0 14px; color: var(--ink-3); font-size: 0.88rem; font-weight: 600; }

.pd-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; }
.pd-card { display: flex; flex-direction: column; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 18px; transition: border-color 0.15s var(--ease-out), box-shadow 0.15s; }
@media (hover: hover) and (pointer: fine) { .pd-card:hover { border-color: #d3dced; box-shadow: var(--shadow-sm); } }
.pd-card__top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pd-badge { display: inline-flex; align-items: center; border-radius: var(--r-pill); padding: 3px 11px; font-size: 0.76rem; font-weight: 700; letter-spacing: 0.01em; }
.pd-badge--live { background: var(--green-tint); color: var(--green); }
.pd-badge--draft { background: var(--grey-tint); color: var(--ink-2); }
.pd-badge--off { background: var(--red-tint); color: var(--red); }
.pd-badge--fix { background: var(--orange-tint); color: var(--orange); }
.pd-badge--mod { background: var(--blue-tint); color: var(--blue-ink); }
.pd-badge--sale { background: var(--gold); color: #4a2c00; }
.pd-card__title { margin: 0; font-weight: 700; font-size: 1.02rem; line-height: 1.3; letter-spacing: -0.01em; }
.pd-card__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--ink-2); font-size: 0.9rem; }
.pd-price { font-weight: 700; color: var(--ink); }
.pd-dot { color: var(--ink-3); }
.pd-meta-i { display: inline-flex; align-items: center; gap: 5px; }
.pd-meta-i .pd-ic { width: 15px; height: 15px; color: var(--ink-3); }
.pd-meta-i--ok { color: var(--green); }
.pd-meta-i--ok .pd-ic { color: var(--green); }
.pd-card__note { display: flex; align-items: flex-start; gap: 7px; margin: 0; background: var(--orange-tint); color: var(--orange); border-radius: var(--r-md); padding: 8px 11px; font-size: 0.85rem; line-height: 1.4; }
.pd-card__note .pd-ic { width: 15px; height: 15px; flex: none; margin-top: 2px; }
.pd-card__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 4px; flex-wrap: wrap; }
.pd-folder { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-3); font-size: 0.84rem; font-weight: 600; }
.pd-folder .pd-ic { width: 15px; height: 15px; }
.pd-card__link { color: var(--blue-ink); font-weight: 700; font-size: 0.86rem; text-decoration: none; white-space: nowrap; }
@media (hover: hover) and (pointer: fine) { .pd-card__link:hover { text-decoration: underline; } }

.pd-empty { color: var(--ink-3); text-align: center; padding: 50px 0; }

/* bulk discounts */
.pd-head__btns { display: inline-flex; gap: 10px; flex-wrap: wrap; }
.pd-btn--ghost.is-on { background: var(--gold); color: #4a2c00; border-color: var(--gold); }
.pd-oldprice { margin-left: 7px; color: var(--ink-3); font-weight: 500; font-size: 0.85em; }
.pd-check-box { width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--line); display: grid; place-items: center; margin-right: auto; }
.pd-check-box svg { width: 13px; height: 13px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
.pd-check-box.is-on { background: var(--blue); border-color: var(--blue); }
.pd-check-box.is-on svg { opacity: 1; }
.pd-card.is-sel { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue); }
.pd-card.is-free { opacity: 0.5; cursor: default; }
.pd-salebar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 200; background: var(--surface); border-top: 1px solid var(--line); box-shadow: 0 -8px 24px -16px rgba(9, 23, 71, 0.3); padding: 14px 0; }
.pd-salebar__in { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.pd-salebar__sel { display: inline-flex; align-items: center; gap: 12px; font-size: 0.95rem; flex-wrap: wrap; }
.pd-salebar__act { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pd-salebar__pct { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.95rem; }
.pd-salebar__pct input { width: 60px; border: 1px solid var(--line); border-radius: var(--r-md); padding: 7px 10px; font-family: inherit; font-size: 0.96rem; text-align: center; }
.pd-salebar__pct input:focus { outline: none; border-color: var(--blue-soft); box-shadow: 0 0 0 3px var(--blue-tint); }
.pd-link { border: 0; background: none; padding: 0; cursor: pointer; color: var(--blue-ink); font-weight: 600; font-size: 0.9rem; font-family: inherit; }
@media (hover: hover) and (pointer: fine) { .pd-link:hover { text-decoration: underline; } }

.pd-card--btn { cursor: pointer; text-align: left; font: inherit; color: inherit; }
.pd-card--btn:focus-visible { outline: 2px solid var(--blue-soft); outline-offset: 2px; }
.pd-chip--gear { padding: 7px 10px; color: var(--ink-3); }
.pd-chip--gear .pd-ic { width: 17px; height: 17px; }

/* buttons: danger + ghost variants (primary .pd-btn defined above) */
.pd-btn--ghost { background: var(--surface); color: var(--ink-2); border: 1px solid var(--line); }
.pd-btn--danger { background: var(--red); color: #fff; }
@media (hover: hover) and (pointer: fine) {
    .pd-btn--ghost:not(:disabled):hover { background: var(--bg-tint); color: var(--ink); }
    .pd-btn--danger:not(:disabled):hover { background: #c0002a; transform: translateY(-1px); }
}

/* modal + dialog */
.pd-modal { position: fixed; inset: 0; z-index: 1000; background: rgba(9, 23, 71, 0.42); display: grid; place-items: center; padding: 20px; overflow-y: auto; }
.pd-dialog { position: relative; width: 100%; max-width: 560px; background: var(--surface); border-radius: var(--r-lg); box-shadow: 0 30px 80px -30px rgba(9, 23, 71, 0.5); display: flex; flex-direction: column; max-height: calc(100vh - 40px); }
.pd-dialog--sm { max-width: 420px; }
.pd-dialog__head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid var(--line); }
.pd-dialog__title { margin: 0; font-weight: 800; font-size: 1.15rem; letter-spacing: -0.02em; }
.pd-x { border: 0; background: none; padding: 4px; cursor: pointer; color: var(--ink-3); border-radius: 8px; }
.pd-x .pd-ic { width: 20px; height: 20px; }
@media (hover: hover) and (pointer: fine) { .pd-x:hover { background: var(--bg-tint); color: var(--ink); } }
/* flex:1 + min-height:0 make the body the SOLE internal scroll region; without min-height:0 the flex
   child won't shrink below its min-content, the overlay scrolls instead, and scrolling a
   grid/place-items:center overlay repaints the tint + shadow every frame → flicker. */
.pd-dialog__body { flex: 1 1 auto; min-height: 0; padding: 18px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
.pd-dialog__body--load { padding: 48px 22px; text-align: center; color: var(--ink-3); }
.pd-dialog__foot { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 14px 22px 20px; border-top: 1px solid var(--line); }
.pd-spacer { flex: 1; }

.pd-field { display: flex; flex-direction: column; gap: 6px; }
.pd-field__lb { font-size: 0.86rem; font-weight: 600; color: var(--ink-2); }
.pd-req { color: var(--red); margin-left: 2px; }
.pd-input { width: 100%; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); padding: 10px 13px; font-family: inherit; font-size: 0.96rem; color: var(--ink); }
.pd-input:focus { outline: none; border-color: var(--blue-soft); box-shadow: 0 0 0 3px var(--blue-tint); }
.pd-input::placeholder { color: var(--ink-3); }
.pd-textarea { resize: vertical; min-height: 62px; line-height: 1.5; }
.pd-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2398a0ad' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-size: 18px; padding-right: 38px; cursor: pointer; }
.pd-seg { display: inline-flex; gap: 4px; background: var(--bg-tint); border-radius: var(--r-md); padding: 4px; }
.pd-seg__b { border: 0; background: none; border-radius: 9px; padding: 8px 16px; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: var(--ink-2); cursor: pointer; transition: background 0.14s var(--ease-out), color 0.14s; }
.pd-seg__b.is-on { background: var(--surface); color: var(--blue-ink); box-shadow: var(--shadow-sm); }
.pd-hint { margin: 0; color: var(--ink-3); font-size: 0.85rem; }

/* moderation block */
.pd-modblock { background: var(--bg-tint); border: 1px solid var(--line); border-radius: var(--r-md); padding: 13px 15px; display: flex; flex-direction: column; gap: 9px; }
.pd-modblock__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pd-modblock__lb { font-size: 0.86rem; font-weight: 600; color: var(--ink-2); }
.pd-modblock__hint { margin: 0; color: var(--ink-3); font-size: 0.83rem; }
.pd-lock { display: flex; align-items: flex-start; gap: 9px; background: var(--orange-tint); color: var(--orange); border-radius: var(--r-md); padding: 12px 14px; font-size: 0.88rem; font-weight: 600; line-height: 1.45; }
.pd-lock .pd-ic { width: 18px; height: 18px; flex: none; margin-top: 1px; }
.pd-created { display: flex; align-items: center; gap: 9px; background: var(--green-tint, #e7f7ed); color: var(--green, #1f9d57); border-radius: var(--r-md); padding: 11px 14px; font-size: 0.9rem; font-weight: 600; }
.pd-created .pd-ic { width: 18px; height: 18px; flex: none; stroke-width: 2.4; }
.pd-modblock__note { display: flex; align-items: flex-start; gap: 7px; margin: 0; color: var(--orange); font-size: 0.85rem; line-height: 1.4; }
.pd-modblock__note .pd-ic { width: 15px; height: 15px; flex: none; margin-top: 2px; }
.pd-btn--sm { padding: 7px 14px; font-size: 0.86rem; }
.pd-btn--dangerghost { background: var(--surface); color: var(--red); border: 1px solid #f3c4cd; }
@media (hover: hover) and (pointer: fine) { .pd-btn--dangerghost:not(:disabled):hover { background: var(--red-tint); } }

/* access & price */
.pd-money { display: flex; flex-direction: column; gap: 14px; border-top: 1px solid var(--line); padding-top: 16px; }
.pd-money__h { font-size: 0.92rem; font-weight: 800; letter-spacing: -0.01em; }
.pd-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pd-opt { font-style: normal; font-weight: 400; color: var(--ink-3); font-size: 0.82rem; }
.pd-check { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; font-size: 0.95rem; font-weight: 600; color: var(--ink); user-select: none; }
.pd-check input { width: 18px; height: 18px; accent-color: var(--blue); cursor: pointer; flex: none; }

/* lessons */
.pd-lessons { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--line); padding-top: 16px; }
.pd-lessons__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pd-llist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pd-lrow { display: flex; align-items: center; gap: 10px; background: var(--bg-tint); border-radius: var(--r-md); padding: 8px 10px 8px 12px; }
.pd-lrow__n { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--surface); border: 1px solid var(--line); display: grid; place-items: center; font-size: 0.76rem; font-weight: 700; color: var(--ink-2); }
.pd-lrow__t { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; font-size: 0.92rem; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-lrow__ic { width: 15px; height: 15px; color: var(--ink-3); flex: none; }
.pd-lrow__ic--v { color: var(--green); }
.pd-lrow__act { display: inline-flex; align-items: center; gap: 2px; flex: none; }
.pd-iconbtn { border: 0; background: none; padding: 5px; cursor: pointer; color: var(--ink-3); border-radius: 7px; line-height: 0; }
.pd-iconbtn .pd-ic { width: 17px; height: 17px; }
.pd-iconbtn:disabled { opacity: 0.35; cursor: default; }
@media (hover: hover) and (pointer: fine) { .pd-iconbtn:not(:disabled):hover { background: #e2e9f6; color: var(--ink); } .pd-iconbtn--del:not(:disabled):hover { background: var(--red-tint); color: var(--red); } }

.pd-modal--top { z-index: 1100; background: rgba(9, 23, 71, 0.3); }
.pd-formerr--inline { margin: 0; padding: 8px 11px; border-top: 0; border-radius: var(--r-md); }
.pd-matrow { display: flex; align-items: center; gap: 8px; }
.pd-matrow__link { flex: 1; min-width: 0; display: inline-flex; align-items: center; gap: 7px; color: var(--blue-ink); font-weight: 600; font-size: 0.9rem; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-matrow__link .pd-ic { width: 16px; height: 16px; flex: none; }
@media (hover: hover) and (pointer: fine) { .pd-matrow__link:hover { text-decoration: underline; } }
.pd-upl { position: relative; align-self: flex-start; overflow: hidden; }
.pd-hidden-file { position: absolute; inset: 0; opacity: 0; cursor: pointer; font-size: 0; }

/* video (teaser + lesson) */
.pd-teaser { display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--line); padding-top: 16px; }
.pd-cover { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.pd-cover__img { width: 100%; max-height: 240px; border-radius: var(--r-md); object-fit: cover; border: 1px solid var(--line); }

/* manual access grants */
.pd-grant { display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--line); padding-top: 16px; }
.pd-search--full { max-width: none; }
.pd-grant__search { position: relative; display: flex; flex-direction: column; gap: 8px; }
.pd-grant__res, .pd-grant__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pd-grant__res li, .pd-grant__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--bg-tint); border-radius: var(--r-md); padding: 8px 10px 8px 12px; }
.pd-grant__u { display: inline-flex; align-items: center; gap: 9px; min-width: 0; }
.pd-grant__ava { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-grant__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.75rem; }
.pd-grant__name { display: flex; flex-direction: column; min-width: 0; font-size: 0.92rem; font-weight: 600; color: var(--ink); line-height: 1.2; }
.pd-grant__name em { font-style: normal; font-weight: 400; font-size: 0.8rem; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-grant__act { display: inline-flex; align-items: center; gap: 2px; flex: none; }
.pd-iconbtn { text-decoration: none; }
.pd-grant__tag { display: inline-block; padding: 1px 7px; border-radius: var(--r-pill); font-size: 0.72rem; font-weight: 700; }
.pd-grant__tag--buy { background: var(--green-tint); color: var(--green); }
.pd-grant__tag--free { background: var(--blue-tint); color: var(--blue-ink); }
.pd-grant__tag--pending { background: var(--grey-tint); color: var(--ink-2); }
.pd-vprog { display: flex; flex-direction: column; gap: 6px; }
.pd-vprog__bar { height: 8px; border-radius: var(--r-pill); background: var(--bg-tint); overflow: hidden; }
.pd-vprog__bar span { display: block; height: 100%; width: 100%; background: var(--blue); border-radius: var(--r-pill); transform-origin: left; transition: transform 0.2s var(--ease-out); }
.pd-vprog__t { font-size: 0.86rem; font-weight: 600; color: var(--ink-2); }
.pd-vframe { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--r-md); overflow: hidden; background: #0b1e52; }
.pd-vframe iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.pd-vactions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pd-vresume { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.pd-formerr { margin: 0; padding: 10px 22px; background: var(--red-tint); color: var(--red); font-size: 0.88rem; font-weight: 600; border-top: 1px solid var(--line); }

/* delete-confirm overlay (inside the dialog) */
.pd-confirm { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.86); backdrop-filter: blur(2px); border-radius: var(--r-lg); display: grid; place-items: center; padding: 20px; }
.pd-confirm__box { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: 0 20px 50px -24px rgba(9, 23, 71, 0.4); padding: 22px; max-width: 400px; }
.pd-confirm__t { margin: 0 0 6px; font-weight: 800; font-size: 1.02rem; }
.pd-confirm__d { margin: 0 0 16px; color: var(--ink-2); font-size: 0.9rem; line-height: 1.5; }
.pd-confirm__foot { display: flex; justify-content: flex-end; gap: 10px; }

/* folders modal */
.pd-newfolder { display: flex; gap: 8px; }
.pd-newfolder .pd-btn { white-space: nowrap; }
.pd-flist { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pd-frow { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--bg-tint); border-radius: var(--r-md); padding: 9px 12px; }
.pd-frow__t { display: inline-flex; align-items: center; gap: 8px; font-size: 0.94rem; font-weight: 600; color: var(--ink); }
.pd-frow__t .pd-ic { width: 16px; height: 16px; color: var(--ink-3); }
.pd-frow__t em { color: var(--ink-3); font-style: normal; font-weight: 700; font-size: 0.82rem; }
.pd-frow__del { border: 0; background: none; padding: 5px; cursor: pointer; color: var(--ink-3); border-radius: 7px; }
.pd-frow__del .pd-ic { width: 17px; height: 17px; }
@media (hover: hover) and (pointer: fine) { .pd-frow__del:not(:disabled):hover { background: var(--red-tint); color: var(--red); } }

@media (max-width: 560px) {
    .pd-grid { grid-template-columns: 1fr; }
    .pd-dialog__foot { flex-wrap: wrap; }
}
</style>
