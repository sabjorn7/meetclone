export default {
  editor: {
    label: {
      en: 'PeerTube Uploader',
      ru: 'Загрузчик PeerTube'
    },
    icon: 'video-camera',
  },
  properties: {
    title: {
      label: { 
        en: 'Title',
        ru: 'Заголовок'
      },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: 'Загрузка видео',
    },
    showTitle: {
      label: { 
        en: 'Show title',
        ru: 'Показать заголовок'
      },
      type: 'OnOff',
      section: 'settings',
      bindable: true,
      defaultValue: true,
    },
    selectFileLabel: {
      label: { 
        en: 'Select file button label',
        ru: 'Текст кнопки выбора файла'
      },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: 'Выбрать файл',
    },
    uploadButtonLabel: {
      label: { 
        en: 'Upload button label',
        ru: 'Текст кнопки загрузки'
      },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: 'Загрузить',
    },
    apiBaseUrl: {
      label: { 
        en: 'API Base URL',
        ru: 'Базовый URL API'
      },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: 'https://video.meetgu.ru',
    },
    channelId: {
      label: { 
        en: 'Channel ID',
        ru: 'ID канала'
      },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: '5',
    },
    accessToken: {
      label: { 
        en: 'Access Token',
        ru: 'Токен доступа'
      },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: '',
    }
  },
  triggerEvents: [
    {
      name: 'fileSelected',
      label: { 
        en: 'On file selected',
        ru: 'При выборе файла'
      },
      event: { 
        fileName: '',
        fileSize: 0,
        fileType: ''
      }
    },
    {
      name: 'uploadStarted',
      label: { 
        en: 'On upload started',
        ru: 'При начале загрузки'
      },
      event: { 
        uploadId: ''
      }
    },
    {
      name: 'uploadResumed',
      label: { 
        en: 'On upload resumed',
        ru: 'При возобновлении загрузки'
      },
      event: { 
        uploadId: '',
        startByte: 0
      }
    },
    {
      name: 'chunkUploaded',
      label: { 
        en: 'On chunk uploaded',
        ru: 'При загрузке части файла'
      },
      event: { 
        uploadId: '',
        bytePosition: 0,
        totalSize: 0
      }
    },
    {
      name: 'uploadSuccess',
      label: { 
        en: 'On upload success',
        ru: 'При успешной загрузке'
      },
      event: { 
        id: 0,
        shortUUID: '',
        uuid: '',
        uploadId: ''
      }
    },
    {
      name: 'uploadError',
      label: { 
        en: 'On upload error',
        ru: 'При ошибке загрузки'
      },
      event: { 
        error: '',
        uploadId: '',
        bytePosition: 0
      }
    },
    {
      name: 'uploadCancelled',
      label: { 
        en: 'On upload cancelled',
        ru: 'При отмене загрузки'
      },
      event: { 
        uploadId: ''
      }
    }
  ],
  actions: [
    {
      label: { 
        en: 'Update access token',
        ru: 'Обновить токен доступа'
      },
      action: 'updateAccessToken',
      args: [
        {
          name: 'token',
          type: 'string',
          label: { 
            en: 'Access token',
            ru: 'Токен доступа'
          }
        }
      ]
    },
    {
      label: { 
        en: 'Set upload mode',
        ru: 'Установить режим загрузки'
      },
      action: 'updateUploadMode',
      args: [
        {
          name: 'mode',
          type: 'string',
          label: { 
            en: 'Mode (new/resume)',
            ru: 'Режим (new/resume)'
          }
        }
      ]
    },
    {
      label: { 
        en: 'Set resume parameters',
        ru: 'Установить параметры возобновления'
      },
      action: 'updateResumeParams',
      args: [
        {
          name: 'uploadId',
          type: 'string',
          label: { 
            en: 'Upload ID',
            ru: 'ID загрузки'
          }
        },
        {
          name: 'chunkPosition',
          type: 'number',
          label: { 
            en: 'Chunk position',
            ru: 'Позиция чанка'
          }
        }
      ]
    },
    {
      label: { 
        en: 'Cancel upload',
        ru: 'Отменить загрузку'
      },
      action: 'cancelUpload'
    }
  ]
};