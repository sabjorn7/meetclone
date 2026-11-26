<template>
    <div v-if="enabled" class="club-attachments">
        <input ref="picker" type="file" :accept="ACCEPT_ATTR" hidden @change="pick" />
        <div class="club-attachments__tools">
            <button type="button" class="pd-attach-btn" aria-label="Прикрепить файл" title="Прикрепить файл" :disabled="busy || recording || requesting || !!pending" @click="picker.click()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" /></svg>
            </button>
            <button v-if="audioSupported && !recording" type="button" class="pd-attach-btn" aria-label="Записать голосовое" title="Записать голосовое" :disabled="busy || requesting || !!pending" @click="start">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 19v3" /></svg>
            </button>
        </div>
        <button v-if="composerUid" type="button" class="club-attachments__send" aria-label="Отправить сообщение" title="Отправить сообщение" :disabled="!hasText" @click="submitText">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-6-7-2z" /></svg>
        </button>
        <div v-if="recording" class="pd-recbar">
            <span class="pd-recbar__dot" aria-hidden="true"></span><span class="pd-recbar__hint" role="status">Идёт запись</span>
            <button type="button" class="pd-attach-btn" aria-label="Стоп" title="Остановить запись" @click="stop(false)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg></button>
            <button type="button" class="pd-attach-btn" aria-label="Отмена" title="Отменить запись" @click="stop(true)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
        </div>
        <div v-if="pending" class="pd-attach" :aria-busy="busy">
            <VoiceMessagePlayer v-if="preview" class="pd-attach__voice" :src="preview" />
            <span v-else class="pd-attach__meta"><span class="pd-attach__name">{{ pending.file.name }}</span><span class="pd-attach__size">{{ formatBytes(pending.file.size) }}</span></span>
            <span v-if="busy" class="pd-attach__size" role="status">Отправка…</span>
            <button type="button" class="pd-attach-btn pd-attach-btn--send" aria-label="Отправить вложение" title="Отправить вложение" :disabled="busy" @click="send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" /></svg></button>
            <button type="button" class="pd-attach-btn" aria-label="Убрать" title="Убрать файл" :disabled="busy" @click="clear"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
        </div>
        <p v-if="error" class="pd-attach__err" role="alert">{{ error }}</p>
    </div>
</template>
<script setup>
// Add-on to the existing club composer, not a new chat or a replacement send workflow.
import {computed,inject,ref,onMounted,onBeforeUnmount,watch} from 'vue';
import {getSupabase,readStoredSession} from '../chrome/headerAccount.js';
import {ACCEPT_ATTR,formatBytes,pickAudioFormat,audioRecordingSupported} from '../helpers/chatAttachments.js';
import {encodeBlobToMp3} from '../helpers/mp3Encode.js';
import {clubAttachmentsEnabled,prepareClubAttachment,sendClubAttachment} from '../helpers/clubAttachments.js';
import VoiceMessagePlayer from './VoiceMessagePlayer.vue';
const ctx=inject('_wwLibraryComponentContext',null);
const props=defineProps({composerUid:{type:String,default:''}});
const composerIds=computed(()=>props.composerUid==='6cd0c16b-3776-40d8-840e-4274d72ceccc'
    ? {input:'74e334e1-62d0-4e61-afdc-4da3aa011fcf',send:'7a962394-cf77-43b1-8606-bd8ddf2a8e03'}
    : {input:'2a3dbfa4-eddc-4a3c-9ec4-02a217620d70',send:'5cd08dd6-fdfc-463d-95dd-12c41ac3c8fe'});
const hasText=computed(()=>Boolean(String(ctx?.component?.variables?.[composerIds.value.input+'-value']||'').trim()));
function submitText(event){
    if(!hasText.value)return;
    // Delegate to the original WeWeb click workflow; do not duplicate database writes.
    event.currentTarget.parentElement.parentElement.querySelector('.ww-element-'+composerIds.value.send)?.click();
}

const club=computed(()=>ctx?.component?.variables?.['14d34912-0442-4607-9311-5c9590247a28']?.club?.id);
const picker=ref(null),enabled=ref(false),pending=ref(null),preview=ref(''),busy=ref(false),recording=ref(false),requesting=ref(false),error=ref('');
const audioSupported=audioRecordingSupported();let recorder,stream,timeout,rev=0,dead=false,cancelled=false;
const current=uid=>!dead&&readStoredSession()?.user?.id===uid;
function clear(){if(preview.value)URL.revokeObjectURL(preview.value);preview.value='';pending.value=null;error.value=''}
function select(file){clear();const uid=readStoredSession()?.user?.id;try{pending.value=prepareClubAttachment(file,club.value,uid);if(pending.value.kind==='audio')preview.value=URL.createObjectURL(file)}catch(e){error.value=e.message}}
function pick(e){const file=e.target.files?.[0];e.target.value='';if(file)select(file)}
function cleanup(){clearTimeout(timeout);stream?.getTracks().forEach(t=>t.stop());stream=null;recording.value=false}
function stop(cancel){cancelled=cancel;if(recorder?.state==='recording')recorder.stop();else cleanup()}
async function start(){if(busy.value||recording.value||requesting.value||pending.value)return;const generation=++rev,uid=readStoredSession()?.user?.id;const fmt=pickAudioFormat();if(!uid||!fmt)return;error.value='';requesting.value=true;
 try{const captured=await navigator.mediaDevices.getUserMedia({audio:true});if(dead||generation!==rev||!current(uid)){captured.getTracks().forEach(t=>t.stop());return}stream=captured;const chunks=[];cancelled=false;recorder=new MediaRecorder(stream,{mimeType:fmt.mimeType});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 recorder.onstop=async()=>{cleanup();if(cancelled||dead||generation!==rev||!current(uid))return;if(!chunks.length){error.value='Запись пуста. Попробуйте записать ещё раз.';return}busy.value=true;const blob=new Blob(chunks,{type:fmt.mimeType});let file;try{file=new File([await encodeBlobToMp3(blob)],'voice-message.mp3',{type:'audio/mpeg'})}catch{file=new File([blob],`voice-message.${fmt.ext}`,{type:fmt.mimeType})}finally{busy.value=false}if(!dead&&generation===rev&&current(uid))select(file)};
 recorder.start();recording.value=true;timeout=setTimeout(()=>stop(false),300000);
 }catch{cleanup();error.value='Не удалось начать запись. Проверьте микрофон и разрешение браузера.'}finally{requesting.value=false}}
async function send(){const item=pending.value;if(!item||busy.value)return;busy.value=true;error.value='';try{await sendClubAttachment(getSupabase(),item,current);if(current(item.uid)&&club.value===item.club){clear();await ctx?.component?.methods?.executeWorkflow('b9817663-75ec-436b-b985-ac4399e3fd9f')}}catch{if(!dead)error.value='Не удалось отправить. Вложение сохранено для повторной попытки.'}finally{busy.value=false}}
async function capability(){enabled.value=false;const generation=++rev;const result=await clubAttachmentsEnabled(getSupabase(),club.value);if(!dead&&generation===rev)enabled.value=result}
watch(()=>readStoredSession()?.user?.id,()=>{rev++;stop(true);clear();enabled.value=false;if(readStoredSession()?.user?.id)capability()});
watch(club,()=>{rev++;stop(true);clear();capability()});onMounted(capability);onBeforeUnmount(()=>{dead=true;rev++;stop(true);cleanup();clear()});
</script>
<style scoped>
/* Same icon geometry and controls as ChatsPage, scoped to the existing club add-on. */
.club-attachments { padding: 0 18px 12px; background: #fff; font-family: inherit; min-width: 0; }
.club-attachments__tools { display: flex; align-items: center; gap: 8px; }
.pd-attach-btn { width: 42px; height: 46px; flex: none; padding: 0; border: none; background: none; color: #6b7890; display: grid; place-items: center; cursor: pointer; border-radius: 12px; transition: color .14s, background .14s; }
.pd-attach-btn svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pd-attach-btn:disabled { opacity: .5; cursor: default; }
.pd-attach-btn:focus-visible { outline: 2px solid #2e70dd; outline-offset: 2px; }
.pd-attach-btn--send { background: #2e70dd; color: #fff; }
.pd-attach { display: flex; align-items: center; gap: 10px; min-width: 0; margin: 12px 0 0; padding: 8px 10px; background: #f1f6fd; border: 1px solid #e4e9f1; border-radius: 12px; }
.pd-attach__meta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.pd-attach__name { font-size: .88rem; font-weight: 600; color: #1c2940; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-attach__size { font-size: .75rem; color: #6b7890; }
.pd-attach__voice { flex: 1; min-width: 0; }
.pd-attach__err { margin: 8px 0 0; color: #a82b38; font-size: .82rem; }
.pd-recbar { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.pd-recbar__dot { width: 12px; height: 12px; border-radius: 50%; background: #a82b38; flex: none; }
.pd-recbar__hint { color: #6b7890; font-size: .86rem; flex: 1; }
.club-attachments__send { width: 46px; height: 46px; padding: 0; border: 0; border-radius: 50%; background: #2e70dd; color: #fff; display: grid; place-items: center; cursor: pointer; }
.club-attachments__send svg { width: 22px; height: 22px; fill: currentColor; }
.club-attachments__send:disabled { opacity: .5; cursor: default; }
.club-attachments__send:focus-visible { outline: 2px solid #2e70dd; outline-offset: 3px; }
@media (hover: hover) and (pointer: fine) { .pd-attach-btn:not(:disabled):hover { color: #2e70dd; background: #f1f6fd; } .pd-attach-btn--send:not(:disabled):hover { color: #fff; background: #245bb5; } }
@media (prefers-reduced-motion: reduce) { .pd-attach-btn { transition: none; } }
@media (max-width: 600px) { .club-attachments { padding: 0 10px 10px; } }
</style>
