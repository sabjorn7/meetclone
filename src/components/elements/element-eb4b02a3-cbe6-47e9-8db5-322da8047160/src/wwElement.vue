<template>
<div class="vk-auth-component" :class="{ 'is-loading': isLoading }">
<!-- OAuth 2.0 Redirect Button -->
<button
v-if="content.authMethod === 'oauth'"
class="vk-auth-button"
:style="buttonStyle"
@click="initiateOAuthLogin"
:disabled="isLoading"
>
<div class="vk-auth-button__content">
<div class="vk-auth-button__icon" v-if="!content.hideIcon">
<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<path
fill="currentColor"
d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.523-2.049-1.72-1.033-1.01-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.573c0 .424-.136.593-1.252.593-1.844 0-3.896-1.122-5.342-3.208-2.17-3.05-2.778-5.342-2.778-5.817 0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.864 2.468 2.303 4.63 2.896 4.63.22 0 .322-.102.322-.66V9.473c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.743c.373 0 .508.203.508.643v3.463c0 .373.17.508.271.508.22 0 .407-.135.813-.542 1.27-1.422 2.183-3.615 2.183-3.615.119-.254.305-.491.729-.491h1.744c.525 0 .644.271.525.643-.22 1.032-2.387 4.07-2.387 4.07-.186.305-.254.44 0 .78.186.254.796.779 1.2 1.252.745.864 1.32 1.592 1.473 2.1.17.508-.085.762-.576.762z"
/>
</svg>
</div>
<span class="vk-auth-button__text">{{ content.buttonText }}</span>
</div>
</button>

<!-- VK ID One Tap Container -->
<div v-else-if="content.authMethod === 'onetap'" ref="vkIdContainer" class="vk-id-container"></div>

<!-- Loading Indicator -->
<div v-if="isLoading" class="vk-auth-loading">
<div class="vk-auth-loading__spinner"></div>
</div>

<!-- Telegram WebApp Info (hidden) -->
<div v-if="content.showTelegramInfo" class="telegram-info">
  <div class="telegram-info__item">
    <span class="telegram-info__label">Viewport Height:</span>
    <span class="telegram-info__value">{{ telegramViewportHeight }}</span>
  </div>
  <div class="telegram-info__item">
    <span class="telegram-info__label">Safe Area Inset:</span>
    <span class="telegram-info__value">{{ telegramSafeAreaInset }}</span>
  </div>
  <div class="telegram-info__item">
    <span class="telegram-info__label">Platform:</span>
    <span class="telegram-info__value">{{ telegramPlatform }}</span>
  </div>
  <div class="telegram-info__item">
    <span class="telegram-info__label">Color Scheme:</span>
    <span class="telegram-info__value">{{ telegramColorScheme }}</span>
  </div>
</div>
</div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

export default {
props: {
content: { type: Object, required: true },
uid: { type: String, required: true },
},
emits: ['trigger-event'],
setup(props, { emit }) {
// Editor state
const isEditing = computed(() => {
// eslint-disable-next-line no-unreachable
return false;
});

// Component state
const isLoading = ref(false);
const vkIdContainer = ref(null);
const vkSdkLoaded = ref(false);
const oneTapInstance = ref(null);

// Internal variables to expose to WeWeb
const { value: authCode, setValue: setAuthCode } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'authCode',
type: 'string',
defaultValue: '',
});

const { value: deviceId, setValue: setDeviceId } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'deviceId',
type: 'string',
defaultValue: '',
});

const { value: authError, setValue: setAuthError } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'authError',
type: 'string',
defaultValue: '',
});

// Telegram WebApp internal variables
const { value: telegramViewportHeight, setValue: setTelegramViewportHeight } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramViewportHeight',
type: 'number',
defaultValue: 0,
});

const { value: telegramSafeAreaInset, setValue: setTelegramSafeAreaInset } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramSafeAreaInset',
type: 'object',
defaultValue: { top: 0, right: 0, bottom: 0, left: 0 },
});

const { value: telegramPlatform, setValue: setTelegramPlatform } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramPlatform',
type: 'string',
defaultValue: '',
});

const { value: telegramColorScheme, setValue: setTelegramColorScheme } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramColorScheme',
type: 'string',
defaultValue: '',
});

const { value: telegramThemeParams, setValue: setTelegramThemeParams } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramThemeParams',
type: 'object',
defaultValue: {},
});

const { value: telegramInitData, setValue: setTelegramInitData } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramInitData',
type: 'string',
defaultValue: '',
});

const { value: telegramInitDataUnsafe, setValue: setTelegramInitDataUnsafe } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramInitDataUnsafe',
type: 'object',
defaultValue: {},
});

const { value: telegramHeaderColor, setValue: setTelegramHeaderColor } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramHeaderColor',
type: 'string',
defaultValue: '',
});

const { value: telegramBackgroundColor, setValue: setTelegramBackgroundColor } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramBackgroundColor',
type: 'string',
defaultValue: '',
});

const { value: telegramIsExpanded, setValue: setTelegramIsExpanded } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramIsExpanded',
type: 'boolean',
defaultValue: false,
});

const { value: telegramVersion, setValue: setTelegramVersion } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'telegramVersion',
type: 'string',
defaultValue: '',
});

// Computed properties
const buttonStyle = computed(() => {
return {
backgroundColor: props.content?.buttonColor || '#0077FF',
color: props.content?.buttonTextColor || '#FFFFFF',
borderRadius: props.content?.buttonBorderRadius || '4px',
padding: props.content?.buttonPadding || '10px 16px',
fontSize: props.content?.buttonFontSize || '14px',
fontWeight: props.content?.buttonFontWeight || '500',
border: props.content?.buttonBorder || 'none',
};
});

// Methods
const validateAppConfig = () => {
if (!props.content?.appId) {
setAuthError('VK App ID is required');
emitError('VK App ID is required');
return false;
}

if (!props.content?.redirectUri) {
setAuthError('Redirect URI is required');
emitError('Redirect URI is required');
return false;
}

return true;
};

const loadVkSdk = () => {
if (isEditing.value || vkSdkLoaded.value) return;

const document = wwLib.getFrontDocument();
const script = document.createElement('script');
script.src = 'https://unpkg.com/@vkid/sdk@2.6.0/dist-sdk/umd/index.js';
script.async = true;
script.onload = () => {
vkSdkLoaded.value = true;
if (props.content?.authMethod === 'onetap') {
initVkIdOneTap();
}
};
script.onerror = () => {
setAuthError('Failed to load VK SDK');
emitError('Failed to load VK SDK');
};
document.head.appendChild(script);
};

const initVkIdOneTap = () => {
if (isEditing.value || !vkSdkLoaded.value || !vkIdContainer.value) return;

if (!validateAppConfig()) {
return;
}

const window = wwLib.getFrontWindow();
if (!window.VKIDSDK) {
setAuthError('VK SDK not loaded properly');
emitError('VK SDK not loaded properly');
return;
}

try {
const VKID = window.VKIDSDK;

// Initialize VKID config
VKID.Config.init({
app: parseInt(props.content?.appId, 10),
redirectUrl: props.content?.redirectUri,
responseMode: props.content?.backendTokenExchange === true 
? VKID.ConfigResponseMode.Code 
: VKID.ConfigResponseMode.Callback,
source: VKID.ConfigSource.LOWCODE,
scope: props.content?.scopes || '',
});

// Create and render OneTap
oneTapInstance.value = new VKID.OneTap({
showAgreements: props.content?.showAgreements !== false,
skin: props.content?.oneTapButtonSkin || 'primary',
buttonSkin: props.content?.oneTapButtonSkin || 'primary',
buttonSize: props.content?.oneTapButtonSize || 'large',
});

oneTapInstance.value.render({
container: vkIdContainer.value,
showAlternativeLogin: props.content?.showAlternativeLogin !== false
})
.on(VKID.WidgetEvents.ERROR, handleOneTapError)
.on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => {
const code = payload.code;
const deviceId = payload.device_id;

// Handle success directly or exchange code if needed
handleOneTapSuccess({
code: code,
device_id: deviceId
});
});
} catch (error) {
setAuthError(`VK SDK initialization error: ${error.message}`);
emitError(`VK SDK initialization error: ${error.message}`);
}
};

const handleOneTapSuccess = (data) => {
if (!data) {
setAuthError('Invalid response from VK ID');
emitError('Invalid response from VK ID');
return;
}

const code = data.code;
const device_id = data.device_id;
let code_verifier = '';

// Extract code_verifier from cookies if backendTokenExchange is enabled
if (props.content?.backendTokenExchange === true) {
const document = wwLib.getFrontDocument();
code_verifier = (document.cookie.match(/(?:^|; )VK_code_verifier=([^;]+)/)||[])[1]||'';
}

// Set internal variables
setAuthCode(code || '');
setDeviceId(device_id || '');
setAuthError('');

// Emit success event with code_verifier
emit('trigger-event', {
name: 'success',
event: {
code: code || '',
device_id: device_id || '',
code_verifier: code_verifier
}
});
};

const initiateOAuthLogin = () => {
if (isEditing.value) return;

if (!validateAppConfig()) {
return;
}

try {
isLoading.value = true;
const window = wwLib.getFrontWindow();

// Build OAuth URL
const oauthUrl = new URL('https://oauth.vk.com/authorize');
oauthUrl.searchParams.append('client_id', props.content?.appId);
oauthUrl.searchParams.append('redirect_uri', props.content?.redirectUri);
oauthUrl.searchParams.append('scope', props.content?.scopes || 'email');
oauthUrl.searchParams.append('response_type', 'code');
oauthUrl.searchParams.append('v', '5.131'); // Ensure API version is set

// Add optional parameters if provided
if (props.content?.state) {
oauthUrl.searchParams.append('state', props.content?.state);
}

// Redirect to VK OAuth page
window.location.href = oauthUrl.toString();
} catch (error) {
isLoading.value = false;
setAuthError(`OAuth redirect error: ${error.message}`);
emitError(`OAuth redirect error: ${error.message}`);
}
};

const handleOneTapError = (error) => {
const errorMessage = error?.error_description || error?.error || 'Unknown VK ID error';
setAuthError(errorMessage);
emitError(errorMessage);
};

const checkForOAuthCode = () => {
if (isEditing.value) return;

try {
const window = wwLib.getFrontWindow();
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const error = urlParams.get('error');
const errorDescription = urlParams.get('error_description');

if (code) {
// Set internal variables
setAuthCode(code);
setDeviceId('');
setAuthError('');

// Emit success event
emit('trigger-event', {
name: 'success',
event: {
code: code,
device_id: '',
}
});

// Clean URL if configured to do so
if (props.content?.cleanUrlAfterAuth) {
const newUrl = window.location.href.split('?')[0];
window.history.replaceState({}, document.title, newUrl);
}
} else if (error || errorDescription) {
// Handle specific VK error messages
let errorMsg = errorDescription || error || 'Unknown OAuth error';

// Check for common VK error patterns
if (errorMsg.includes('способ авторизации не доступен')) {
errorMsg = 'The selected authentication method is not available for this application. Please check your VK app settings and ensure it has the required permissions.';
}

setAuthError(errorMsg);
emitError(errorMsg);
}
} catch (error) {
setAuthError(`Error checking OAuth response: ${error.message}`);
emitError(`Error checking OAuth response: ${error.message}`);
}
};

const emitError = (errorMessage) => {
emit('trigger-event', {
name: 'error',
event: {
error: errorMessage
}
});
};

// Telegram WebApp methods
const initTelegramWebApp = () => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) {
// Not running in Telegram WebApp
return;
}

try {
const tg = window.Telegram.WebApp;


// Set all Telegram WebApp variables
setTelegramViewportHeight(tg.viewportHeight || 0);
setTelegramSafeAreaInset(tg.safeAreaInset || { top: 0, right: 0, bottom: 0, left: 0 });
setTelegramPlatform(tg.platform || '');
setTelegramColorScheme(tg.colorScheme || '');
setTelegramThemeParams(tg.themeParams || {});
setTelegramInitData(tg.initData || '');
setTelegramInitDataUnsafe(tg.initDataUnsafe || {});
setTelegramHeaderColor(tg.headerColor || '');
setTelegramBackgroundColor(tg.backgroundColor || '');
setTelegramIsExpanded(tg.isExpanded || false);
setTelegramVersion(tg.version || '');

// Set up event listeners for Telegram WebApp events
tg.onEvent('viewportChanged', updateTelegramViewportData);
tg.onEvent('themeChanged', updateTelegramThemeData);
tg.onEvent('mainButtonClicked', () => {
  emit('trigger-event', {
    name: 'telegramMainButtonClicked',
    event: {}
  });
});
tg.onEvent('backButtonClicked', () => {
  emit('trigger-event', {
    name: 'telegramBackButtonClicked',
    event: {}
  });
});
tg.onEvent('settingsButtonClicked', () => {
  emit('trigger-event', {
    name: 'telegramSettingsButtonClicked',
    event: {}
  });
});
tg.onEvent('invoiceClosed', (eventData) => {
  emit('trigger-event', {
    name: 'telegramInvoiceClosed',
    event: eventData || {}
  });
});
tg.onEvent('popupClosed', (eventData) => {
  emit('trigger-event', {
    name: 'telegramPopupClosed',
    event: eventData || {}
  });
});
tg.onEvent('qrTextReceived', (eventData) => {
  emit('trigger-event', {
    name: 'telegramQrTextReceived',
    event: { text: eventData || '' }
  });
});
tg.onEvent('clipboardTextReceived', (eventData) => {
  emit('trigger-event', {
    name: 'telegramClipboardTextReceived',
    event: { text: eventData || '' }
  });
});

// Emit telegramWebAppReady event
emit('trigger-event', {
  name: 'telegramWebAppReady',
  event: {
    platform: tg.platform,
    version: tg.version
  }
});

} catch (error) {
  console.error('Error initializing Telegram WebApp:', error);
}
};

const updateTelegramViewportData = () => {
const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

const tg = window.Telegram.WebApp;
setTelegramViewportHeight(tg.viewportHeight || 0);
setTelegramSafeAreaInset(tg.safeAreaInset || { top: 0, right: 0, bottom: 0, left: 0 });
setTelegramIsExpanded(tg.isExpanded || false);

emit('trigger-event', {
  name: 'telegramViewportChanged',
  event: {
    viewportHeight: tg.viewportHeight,
    isExpanded: tg.isExpanded,
    safeAreaInset: tg.safeAreaInset
  }
});
};

const updateTelegramThemeData = () => {
const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

const tg = window.Telegram.WebApp;
setTelegramColorScheme(tg.colorScheme || '');
setTelegramThemeParams(tg.themeParams || {});
setTelegramHeaderColor(tg.headerColor || '');
setTelegramBackgroundColor(tg.backgroundColor || '');

emit('trigger-event', {
  name: 'telegramThemeChanged',
  event: {
    colorScheme: tg.colorScheme,
    themeParams: tg.themeParams
  }
});
};

// Telegram WebApp action methods
const telegramExpandApp = () => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

try {
  window.Telegram.WebApp.expand();
} catch (error) {
  console.error('Error expanding Telegram WebApp:', error);
}
};

const telegramCloseApp = () => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

try {
  window.Telegram.WebApp.close();
} catch (error) {
  console.error('Error closing Telegram WebApp:', error);
}
};

const telegramSetupMainButton = (params) => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

try {
  const mainButton = window.Telegram.WebApp.MainButton;
  
  if (params?.text) mainButton.setText(params.text);
  if (params?.color) mainButton.setBackgroundColor(params.color);
  if (params?.textColor) mainButton.setTextColor(params.textColor);
  if (params?.isVisible !== undefined) {
    params.isVisible ? mainButton.show() : mainButton.hide();
  }
  if (params?.isActive !== undefined) {
    params.isActive ? mainButton.enable() : mainButton.disable();
  }
  if (params?.isProgressVisible !== undefined) {
    params.isProgressVisible ? mainButton.showProgress() : mainButton.hideProgress();
  }
} catch (error) {
  console.error('Error setting up Telegram MainButton:', error);
}
};

const telegramSetupBackButton = (isVisible) => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

try {
  const backButton = window.Telegram.WebApp.BackButton;
  isVisible ? backButton.show() : backButton.hide();
} catch (error) {
  console.error('Error setting up Telegram BackButton:', error);
}
};

const telegramShowPopup = (params) => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

try {
  window.Telegram.WebApp.showPopup(params, (buttonId) => {
    emit('trigger-event', {
      name: 'telegramPopupClosed',
      event: { buttonId }
    });
  });
} catch (error) {
  console.error('Error showing Telegram popup:', error);
}
};

const telegramShowAlert = (message) => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

try {
  window.Telegram.WebApp.showAlert(message, () => {
    emit('trigger-event', {
      name: 'telegramAlertClosed',
      event: {}
    });
  });
} catch (error) {
  console.error('Error showing Telegram alert:', error);
}
};

const telegramShowConfirm = (message) => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

try {
  window.Telegram.WebApp.showConfirm(message, (confirmed) => {
    emit('trigger-event', {
      name: 'telegramConfirmClosed',
      event: { confirmed }
    });
  });
} catch (error) {
  console.error('Error showing Telegram confirm:', error);
}
};

const telegramScanQrCode = () => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

try {
  window.Telegram.WebApp.showScanQrPopup({}, (text) => {
    emit('trigger-event', {
      name: 'telegramQrTextReceived',
      event: { text }
    });
  });
} catch (error) {
  console.error('Error showing Telegram QR scanner:', error);
}
};

const telegramReadClipboard = () => {
if (isEditing.value) return;

const window = wwLib.getFrontWindow();
if (!window.Telegram || !window.Telegram.WebApp) return;

try {
  window.Telegram.WebApp.readTextFromClipboard((text) => {
    emit('trigger-event', {
      name: 'telegramClipboardTextReceived',
      event: { text }
    });
  });
} catch (error) {
  console.error('Error reading from Telegram clipboard:', error);
}
};

// Lifecycle hooks
onMounted(() => {
if (!isEditing.value) {
// Check for OAuth code in URL (for redirect flow)
checkForOAuthCode();

// Load VK SDK (for One Tap flow)
if (props.content?.authMethod === 'onetap') {
loadVkSdk();
}

// Initialize Telegram WebApp if available
initTelegramWebApp();
}
});

onUnmounted(() => {
// Cleanup if needed
oneTapInstance.value = null;

// Remove Telegram WebApp event listeners if needed
const window = wwLib.getFrontWindow();
if (window.Telegram && window.Telegram.WebApp) {
  try {
    window.Telegram.WebApp.offEvent('viewportChanged', updateTelegramViewportData);
    window.Telegram.WebApp.offEvent('themeChanged', updateTelegramThemeData);
  } catch (error) {
    console.error('Error removing Telegram WebApp event listeners:', error);
  }
}
});

// Watch for changes in configuration
watch(() => props.content?.authMethod, (newMethod) => {
if (newMethod === 'onetap' && !isEditing.value) {
if (vkSdkLoaded.value) {
initVkIdOneTap();
} else {
loadVkSdk();
}
}
});

watch(() => props.content?.appId, () => {
if (props.content?.authMethod === 'onetap' && vkSdkLoaded.value && !isEditing.value) {
initVkIdOneTap();
}
});

return {
isEditing,
isLoading,
vkIdContainer,
buttonStyle,
initiateOAuthLogin,
authCode,
deviceId,
authError,
// Telegram WebApp variables
telegramViewportHeight,
telegramSafeAreaInset,
telegramPlatform,
telegramColorScheme,
telegramThemeParams,
telegramInitData,
telegramInitDataUnsafe,
telegramHeaderColor,
telegramBackgroundColor,
telegramIsExpanded,
telegramVersion,
// Telegram WebApp methods
telegramExpandApp,
telegramCloseApp,
telegramSetupMainButton,
telegramSetupBackButton,
telegramShowPopup,
telegramShowAlert,
telegramShowConfirm,
telegramScanQrCode,
telegramReadClipboard,
};
}
};
</script>

<style lang="scss" scoped>
.vk-auth-component {
position: relative;
display: inline-block;

&.is-loading {
opacity: 0.7;
pointer-events: none;
}
}

.vk-auth-button {
display: inline-flex;
align-items: center;
justify-content: center;
cursor: pointer;
outline: none;
transition: opacity 0.2s ease;
width: 100%;

&:hover {
opacity: 0.9;
}

&:active {
opacity: 0.8;
}

&:disabled {
opacity: 0.6;
cursor: not-allowed;
}

&__content {
display: flex;
align-items: center;
justify-content: center;
gap: 8px;
}

&__icon {
display: flex;
align-items: center;
justify-content: center;
}

&__text {
white-space: nowrap;
}
}

.vk-id-container {
min-height: 40px;
width: 100%;
}

.vk-auth-loading {
position: absolute;
top: 0;
left: 0;
right: 0;
bottom: 0;
display: flex;
align-items: center;
justify-content: center;
background-color: rgba(255, 255, 255, 0.5);

&__spinner {
width: 20px;
height: 20px;
border: 2px solid rgba(0, 119, 255, 0.3);
border-radius: 50%;
border-top-color: #0077FF;
animation: spin 1s linear infinite;
}
}

.telegram-info {
margin-top: 10px;
padding: 10px;
border: 1px solid #ddd;
border-radius: 4px;
font-size: 14px;

&__item {
display: flex;
margin-bottom: 5px;
}

&__label {
font-weight: 500;
margin-right: 5px;
}

&__value {
color: #666;
}
}

@keyframes spin {
to {
transform: rotate(360deg);
}
}
</style>