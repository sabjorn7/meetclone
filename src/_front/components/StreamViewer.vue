<!-- Keep the native PeerTube player independent of the optional quality API.
     A custom __ready handshake can break the player's jschannel state. -->
<template>
    <div class="sp-player">
        <iframe :src="src" allowfullscreen sandbox="allow-same-origin allow-scripts allow-popups allow-forms" allow="autoplay; fullscreen" title="Видеотрансляция"></iframe>
    </div>
</template>
<script setup>
defineProps({ src: { type: String, required: true } });
</script>
<style scoped>
.sp-player { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #0d0f12; border-radius: 12px; overflow: hidden; }
.sp-player iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
</style>
