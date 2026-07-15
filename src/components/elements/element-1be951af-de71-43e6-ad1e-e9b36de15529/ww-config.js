export default {
  editor: {
    label: {
      en: 'Meetgu Video Player',
      ru: 'Meetgu Video Player',
    },
    icon: 'videocam',
    bubble: {
      icon: 'videocam',
    },
  },
  properties: {
    videoUuid: {
      label: { en: 'Video UUID', ru: 'UUID видео' },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: '',
    },
    videoTitle: {
      label: { en: 'Video Title', ru: 'Заголовок' },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: 'Meetgu Video',
    },
    aspectRatio: {
      label: { en: 'Aspect Ratio', ru: 'Соотношение сторон' },
      type: 'TextSelect',
      section: 'settings',
      bindable: true,
      defaultValue: '16/9',
      options: {
        options: [
          { value: '16/9', label: '16:9 (Widescreen)' },
          { value: '4/3', label: '4:3 (Standard)' },
          { value: '1/1', label: '1:1 (Square)' },
          { value: '9/16', label: '9:16 (Vertical)' },
        ],
      },
    },
    maxWidth: {
      label: { en: 'Max Width', ru: 'Макс. ширина' },
      type: 'Length',
      section: 'settings',
      bindable: true,
      defaultValue: '100%',
    },
    placeholderText: {
      label: { en: 'Placeholder Text', ru: 'Текст-плейсхолдер' },
      type: 'Text',
      section: 'settings',
      bindable: true,
      defaultValue: 'Please enter a video UUID',
    },
  },
  triggerEvents: [
    {
      name: 'videoLoaded',
      label: { en: 'On video loaded', ru: 'Видео загружено' },
      event: { uuid: '' },
    },
  ],
};
