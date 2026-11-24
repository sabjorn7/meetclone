<template>
    <div v-if="message.attachment_path" class="club-file">
        <button v-if="!url" type="button" :disabled="busy" @click="open">{{ busy ? 'Загрузка…' : message.attachment_type === 'audio' ? 'Открыть голосовое' : 'Открыть вложение' }}</button>
        <VoiceMessagePlayer v-else-if="message.attachment_type === 'audio'" :src="url" :mine="mine" />
        <a v-else-if="message.attachment_type === 'image'" :href="url" target="_blank" rel="noopener noreferrer" :aria-label="message.attachment_name || 'Открыть фото'"><img :src="url" :alt="message.attachment_name || 'Фото в сообщении'" /></a>
        <a v-else :href="url" target="_blank" rel="noopener noreferrer" download>{{ message.attachment_name || 'Файл' }} · {{ formatBytes(message.attachment_size) }}</a>
        <button v-if="url" type="button" @click="open">Обновить доступ</button>
        <span v-if="error" role="alert">Не удалось открыть. Проверьте подключение и доступ к клубу.</span>
    </div>
</template>
<script setup>
import {ref,watch,onBeforeUnmount} from 'vue';
import VoiceMessagePlayer from './VoiceMessagePlayer.vue';
import {getSupabase,readStoredSession} from '../chrome/headerAccount.js';
import {clubAttachmentUrl} from '../helpers/clubAttachments.js';
import {formatBytes} from '../helpers/chatAttachments.js';
const props=defineProps({message:Object,mine:Boolean});const url=ref(''),busy=ref(false),error=ref(false);let rev=0,timer;
async function open(){const n=++rev,uid=readStoredSession()?.user?.id;url.value='';clearTimeout(timer);busy.value=true;error.value=false;
 try{if(!uid)throw Error();const result=await clubAttachmentUrl(getSupabase(),props.message.attachment_path);if(n===rev&&uid===readStoredSession()?.user?.id){url.value=result;timer=setTimeout(()=>{url.value=''},55000)}}catch{if(n===rev)error.value=true}finally{if(n===rev)busy.value=false}}
watch(()=>readStoredSession()?.user?.id,()=>{rev++;url.value='';busy.value=false;clearTimeout(timer)});
watch(()=>props.message.attachment_path,()=>{rev++;url.value='';clearTimeout(timer)});onBeforeUnmount(()=>{rev++;clearTimeout(timer)});
</script>
<style scoped>.club-file{display:flex;flex-direction:column;gap:8px;max-width:260px;overflow-wrap:anywhere}.club-file img{display:block;width:100%;max-height:240px;object-fit:contain;border-radius:10px}.club-file a,.club-file button{color:inherit}.club-file button{font:inherit;cursor:pointer;padding:8px;border:1px solid currentColor;border-radius:8px;background:transparent}.club-file span{font-size:12px}</style>
