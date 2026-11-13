<template>
    <div class="email-resend">
        <label v-if="editable" class="email-resend__field" :for="inputId">
            <span>Почта для подтверждения</span>
            <input :id="inputId" v-model="address" type="email" autocomplete="email" placeholder="you@example.com" :disabled="busy" />
        </label>
        <button type="button" class="email-resend__button" :disabled="busy || remaining > 0" @click="send">
            {{ busy ? 'Отправляем…' : remaining > 0 ? `Отправить повторно через ${remaining} с` : 'Отправить письмо повторно' }}
        </button>
        <p v-if="message" role="status">{{ message }}</p>
        <p v-if="error" class="email-resend__error" role="alert">{{ error }}</p>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, useId } from 'vue';
import { isRegistrationEmail, resendConfirmation, confirmationError, CONFIRMATION_RESEND_DELAY } from '@/_front/auth/registration.js';
const props = defineProps({ email: { type: String, default: '' }, editable: Boolean, initialCooldown: Boolean });
const inputId = useId();
const address = ref(props.email);
watch(() => props.email, value => { address.value = value; });
const busy = ref(false), message = ref(''), error = ref('');
const now = ref(Date.now());
const nextAllowed = ref(props.initialCooldown ? now.value + CONFIRMATION_RESEND_DELAY : 0);
const remaining = computed(() => Math.max(0, Math.ceil((nextAllowed.value - now.value) / 1000)));
let timer;
onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 1000); });
onBeforeUnmount(() => clearInterval(timer));
async function send() {
    now.value = Date.now();
    if (busy.value || remaining.value > 0) return;
    error.value = ''; message.value = '';
    if (!isRegistrationEmail(address.value)) { error.value = 'Введите корректный адрес электронной почты.'; return; }
    busy.value = true;
    // Also throttle errors/timeouts: the server may have accepted a request before the connection failed.
    nextAllowed.value = now.value + CONFIRMATION_RESEND_DELAY;
    try {
        await resendConfirmation(window.wwLib?.wwPlugins?.supabaseAuth?.publicInstance?.auth, address.value, window.location.origin);
        message.value = 'Если для этого адреса требуется подтверждение, письмо отправлено. Проверьте также папку «Спам».';
    } catch (err) { error.value = confirmationError(err); }
    finally { busy.value = false; now.value = Date.now(); }
}
</script>

<style scoped>
.email-resend { display: grid; gap: 12px; margin-top: 20px; font-size: 0.94rem; line-height: 1.5; overflow-wrap: anywhere; }
.email-resend__field { display: grid; gap: 7px; color: #5b6472; }
.email-resend input { box-sizing: border-box; width: 100%; min-width: 0; padding: 13px 16px; border: 1px solid #e4e9f1; border-radius: 14px; background: #f1f6fd; color: #091747; font: inherit; font-size: 1rem; }
.email-resend__button { justify-self: start; padding: 0; border: 0; background: none; color: #1f5fc9; text-align: start; font: inherit; cursor: pointer; }
.email-resend__button:disabled { color: #5b6472; cursor: default; }
.email-resend__button:focus-visible, .email-resend input:focus-visible { outline: 2px solid #2e70dd; outline-offset: 4px; }
.email-resend p { margin: 0; color: #5b6472; }
.email-resend .email-resend__error { color: #b30025; }
</style>
