<template>
  <div class="peertube-uploader" :class="{ 'is-uploading': isUploading }">
    <div class="upload-container">
      <h3 v-if="props.content.showTitle">{{ props.content.title || 'Загрузка видео' }}</h3>
      
      <div class="file-input-container">
        <label :for="'file-input-' + props.uid" class="file-input-label">
          {{ props.content.selectFileLabel || 'Выбрать файл' }}
        </label>
        <input 
          :id="'file-input-' + props.uid" 
          type="file" 
          accept=".webm,.ogv,.ogg,.mp4,.mkv,.mov,.qt,.mqv,.m4v,.flv,.f4v,.wmv,.avi,.3gp,.3gpp,.3g2,.3gpp2,.nut,.mts,.m2ts,.mpv,.m2v,.m1v,.mpg,.mpe,.mpeg,.vob,.mxf"
          @change="onFileSelected"
          :disabled="isUploading"
        >
        <div class="selected-file" v-if="selectedFile">
          {{ selectedFile.name }}
        </div>
      </div>
      
      <button 
        class="upload-btn" 
        @click="startUpload" 
        :disabled="!canUpload || isUploading"
      >
        {{ props.content.uploadButtonLabel || 'Загрузить' }}
      </button>
      
      <div class="status" v-if="statusMessage">{{ statusMessage }}</div>
      
      <div class="progress-bar" v-if="isUploading">
        <div class="progress" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>
  </div>
</template>


<script>
import { ref, computed, watch } from 'vue';


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
    const selectedFile = ref(null);
    const isUploading = ref(false);
    const statusMessage = ref('');
    const progressPercent = ref(0);
    const uploadId = ref('');
    
    // Constants
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    
    // Internal variables that can be accessed from outside
    const { value: accessToken, setValue: setAccessToken } = wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'accessToken',
      type: 'string',
      defaultValue: props.content.accessToken || '',
    });
    
    const { value: uploadMode, setValue: setUploadMode } = wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'uploadMode',
      type: 'string',
      defaultValue: 'new',
    });
    
    const { value: uploadIdResume, setValue: setUploadIdResume } = wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'uploadIdResume',
      type: 'string',
      defaultValue: '',
    });
    
    const { value: chunkResume, setValue: setChunkResume } = wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'chunkResume',
      type: 'number',
      defaultValue: 0,
    });
    
    const { value: currentChunk, setValue: setCurrentChunk } = wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'currentChunk',
      type: 'number',
      defaultValue: 0,
    });
    
    const { value: fileName, setValue: setFileName } = wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'fileName',
      type: 'string',
      defaultValue: '',
    });
    
    // Список разрешённых расширений PeerTube (как в конфиге transcoding.allow_additional_extensions).[web:79]
    const allowedExtensions = [
      '.webm','.ogv','.ogg','.mp4','.mkv','.mov','.qt','.mqv','.m4v',
      '.flv','.f4v','.wmv','.avi','.3gp','.3gpp','.3g2','.3gpp2',
      '.nut','.mts','.m2ts','.mpv','.m2v','.m1v',
      '.mpg','.mpe','.mpeg','.vob','.mxf'
    ];
    
    const hasAllowedExtension = (name) => {
      const lower = name.toLowerCase();
      return allowedExtensions.some(ext => lower.endsWith(ext));
    };

    // Computed properties
    const canUpload = computed(() => {
      return selectedFile.value && 
             hasAllowedExtension(selectedFile.value.name) && 
             accessToken.value && 
             !isUploading.value;
    });
    
    const apiBaseUrl = computed(() => {
      return props.content.apiBaseUrl || 'https://video.meetgu.ru';
    });
    
    const channelId = computed(() => {
      return props.content.channelId || '5';
    });
    
    // Methods
    const onFileSelected = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      if (!hasAllowedExtension(file.name)) {
        statusMessage.value = 'Этот формат видео не поддерживается PeerTube';
        selectedFile.value = null;
        return;
      }
      
      selectedFile.value = file;
      statusMessage.value = '';
      setFileName(file.name);
      
      // Emit file selected event
      emit('trigger-event', {
        name: 'fileSelected',
        event: { 
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        }
      });
    };
    
    const resetUploader = () => {
      selectedFile.value = null;
      progressPercent.value = 0;
      isUploading.value = false;
      
      // Reset file input by creating a new reference
      const fileInput = document.getElementById('file-input-' + props.uid);
      if (fileInput) fileInput.value = '';
    };
    
    const startUpload = async () => {
      if (isEditing.value) return;
      if (!canUpload.value) {
        statusMessage.value = 'Невозможно начать загрузку';
        return;
      }
      
      const file = selectedFile.value;
      const totalSize = file.size;
      const fileName = file.name;
      const name = file.name.split('.').slice(0, -1).join('.');
      
      isUploading.value = true;
      statusMessage.value = 'Начинаем загрузку...';
      
      try {
        let currentUploadId = '';
        let start = 0;
        
        // Initialize or resume upload
        if (uploadMode.value === 'new') {
          const initResponse = await fetch(`${apiBaseUrl.value}/api/v1/videos/upload-resumable`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken.value}`,
              'X-Upload-Content-Length': totalSize,
              'X-Upload-Content-Type': 'video/mp4'
            },
            body: new URLSearchParams({ 
              channelId: channelId.value, 
              filename: fileName, 
              name,
              privacy: "2" 
            })
          });
          
          if (!initResponse.ok) {
            throw new Error('Ошибка инициализации загрузки');
          }
          
          currentUploadId = initResponse.headers.get('location').split('upload_id=')[1];
          uploadId.value = currentUploadId;
          start = 0;
          
          // Emit upload started event
          emit('trigger-event', {
            name: 'uploadStarted',
            event: { uploadId: currentUploadId }
          });
        } else if (uploadMode.value === 'resume') {
          currentUploadId = uploadIdResume.value;
          start = chunkResume.value;
          uploadId.value = currentUploadId;
          
          // Emit upload resumed event
          emit('trigger-event', {
            name: 'uploadResumed',
            event: { 
              uploadId: currentUploadId,
              startByte: start
            }
          });
        } else {
          throw new Error('Неизвестный режим загрузки');
        }
        
        // Upload chunks
        while (start < totalSize) {
          const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
          const chunk = file.slice(start, end + 1);
          
          try {
            const chunkResponse = await fetch(`${apiBaseUrl.value}/api/v1/videos/upload-resumable?upload_id=${currentUploadId}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${accessToken.value}`,
                'Content-Length': chunk.size,
                'Content-Range': `bytes ${start}-${end}/${totalSize}`
              },
              body: chunk
            });
            
            if (chunkResponse.status === 308) {
              const range = chunkResponse.headers.get('Range');
              if (range) {
                start = parseInt(range.split('-')[1]) + 1;
                setCurrentChunk(start);
                
                // Emit chunk uploaded event
                emit('trigger-event', {
                  name: 'chunkUploaded',
                  event: { 
                    uploadId: currentUploadId,
                    bytePosition: start,
                    totalSize: totalSize
                  }
                });
              }
            } else if (chunkResponse.ok) {
  let id = null, shortUUID = null, uuid = null;
  let responseJson = {};


  try {
    responseJson = await chunkResponse.json();
  } catch (e) {
    console.warn('Пустой ответ JSON при завершении загрузки:', e);
  }


  if (responseJson?.video?.uuid) {
    id = responseJson.video.id;
    shortUUID = responseJson.video.shortUUID;
    uuid = responseJson.video.uuid;
  } else {
    // ⏳ Fallback-запрос через 2 секунды
    statusMessage.value = 'Завершаем загрузку...';
    await new Promise(resolve => setTimeout(resolve, 2000));


    try {
      const confirmRes = await fetch(`${apiBaseUrl.value}/api/v1/videos/uploaded?uploadId=${currentUploadId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken.value}`
        }
      });


      const confirmJson = await confirmRes.json();
      const video = confirmJson?.data?.[0];


      if (video?.uuid) {
        id = video.id;
        shortUUID = video.shortUUID;
        uuid = video.uuid;
      } else {
        throw new Error('UUID не получен даже после повторного запроса');
      }
    } catch (err) {
      console.error('Ошибка получения UUID после загрузки:', err);
      statusMessage.value = 'Видео загружено, но uuid не получен';
      emit('trigger-event', {
        name: 'uploadError',
        event: { error: 'UUID not received after retry', uploadId: currentUploadId }
      });
      resetUploader();
      return;
    }
  }


  statusMessage.value = 'Видео успешно загружено!';
  progressPercent.value = 100;


  emit('trigger-event', {
    name: 'uploadSuccess',
    event: { 
      id,
      shortUUID,
      uuid,
      uploadId: currentUploadId
    }
  });


  resetUploader();
  break;
}
 else {
              throw new Error('Ошибка загрузки чанка');
            }
            
            // Update progress
            progressPercent.value = Math.floor((start / totalSize) * 100);
            
          } catch (chunkError) {
            console.error("Ошибка чанка", chunkError);
            
            // Emit chunk error event
            emit('trigger-event', {
              name: 'uploadError',
              event: { 
                error: chunkError.message,
                uploadId: currentUploadId,
                bytePosition: start
              }
            });
            
            throw chunkError;
          }
        }
      } catch (error) {
        statusMessage.value = `Ошибка: ${error.message}`;
        
        // Emit error event
        emit('trigger-event', {
          name: 'uploadError',
          event: { error: error.message }
        });
        
        console.error("Ошибка загрузки", error);
      } finally {
        if (progressPercent.value < 100) {
          isUploading.value = false;
        }
      }
    };
    
    // Actions that can be called from outside
    const updateAccessToken = (newToken) => {
      if (!newToken) return;
      setAccessToken(newToken);
    };
    
    const updateUploadMode = (mode) => {
      if (mode !== 'new' && mode !== 'resume') return;
      setUploadMode(mode);
    };
    
    const updateResumeParams = (resumeId, resumeChunk) => {
      if (resumeId) setUploadIdResume(resumeId);
      if (typeof resumeChunk === 'number' || typeof resumeChunk === 'string') {
        const chunkNumber = parseInt(resumeChunk, 10);
        if (!isNaN(chunkNumber)) {
          setChunkResume(chunkNumber);
        }
      }
    };
    
    const cancelUpload = () => {
      if (!isUploading.value) return;
      isUploading.value = false;
      statusMessage.value = 'Загрузка отменена';
      progressPercent.value = 0;
      
      // Emit cancel event
      emit('trigger-event', {
        name: 'uploadCancelled',
        event: { uploadId: uploadId.value }
      });
    };
    
    // Watch for content changes
    watch(() => props.content.accessToken, (newToken) => {
      if (newToken) setAccessToken(newToken);
    });
    
    return {
      // Props and state
      props,
      isEditing,
      selectedFile,
      isUploading,
      statusMessage,
      progressPercent,
      canUpload,
      
      // Methods
      onFileSelected,
      startUpload,
      resetUploader,
      updateAccessToken,
      updateUploadMode,
      updateResumeParams,
      cancelUpload,
      
      // Expose variables
      accessToken,
      uploadMode,
      uploadIdResume,
      chunkResume,
      currentChunk,
      fileName,
    };
  }
};
</script>



<style lang="scss" scoped>
.peertube-uploader {
  font-family: Arial, sans-serif;
  width: 100%;
  
  .upload-container {
    width: 100%;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    
    h3 {
      margin: 0 0 10px;
      font-size: 18px;
    }
    
    .file-input-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      
      input[type="file"] {
        display: none;
      }
      
      .file-input-label {
        display: inline-block;
        padding: 8px 16px;
        background-color: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        
        &:hover {
          background-color: #e0e0e0;
        }
      }
      
      .selected-file {
        font-size: 14px;
        color: #555;
        word-break: break-all;
      }
    }
    
    .upload-btn {
      padding: 10px 16px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      
      &:hover:not(:disabled) {
        background-color: #45a049;
      }
      
      &:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
      }
    }
    
    .status {
      font-size: 14px;
      color: #555;
      margin: 5px 0;
    }
    
    .progress-bar {
      width: 100%;
      height: 20px;
      background: #ddd;
      border-radius: 4px;
      overflow: hidden;
      
      .progress {
        height: 100%;
        width: 0%;
        background: #4CAF50;
        transition: width 0.3s ease;
      }
    }
  }
  
  &.is-uploading {
    .upload-btn {
      background-color: #ff9800;
      
      &:hover {
        background-color: #e68a00;
      }
    }
  }
}
</style>
