// ww-config.js
export default {
  editor: {
    label: {
      en: 'Telegram-like Images Row',
    },
    icon: 'image',
  },
  properties: {
    images: {
      label: { en: 'Images list' },
      type: 'Array',
      section: 'settings',
      bindable: true,
      defaultValue: [],
    },
    maxImages: {
      label: { en: 'Max images' },
      type: 'Number',
      section: 'settings',
      bindable: true,
      defaultValue: 10,
    },
    isMobile: {
      label: { en: 'Mobile layout' },
      type: 'Checkbox',
      section: 'settings',
      bindable: true,
      defaultValue: true,
    },
    borderRadius: {
      label: { en: 'Border radius' },
      type: 'Length',
      section: 'design',
      bindable: true,
      defaultValue: '12px',
    },
    rowGap: {
      label: { en: 'Row gap' },
      type: 'Length',
      section: 'design',
      bindable: true,
      defaultValue: '2px',
    },
    columnGap: {
      label: { en: 'Column gap' },
      type: 'Length',
      section: 'design',
      bindable: true,
      defaultValue: '2px',
    },
  },
  triggerEvents: [
    {
      name: 'imageClick',
      label: { en: 'On image click' },
      event: { index: 0, src: '' },
    },
  ],
};