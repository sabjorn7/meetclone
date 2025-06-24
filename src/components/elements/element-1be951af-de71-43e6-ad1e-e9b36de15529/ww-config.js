export default {
editor: {
label: {
en: 'Meetgu Video Player',
},
icon: 'video-camera',
},
properties: {
videoUuid: {
label: { en: 'Video UUID' },
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: '',
},
title: {
label: { en: 'Video Title' },
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: 'Meetgu Video',
},
aspectRatio: {
label: { en: 'Aspect Ratio' },
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
label: { en: 'Max Width' },
type: 'Length',
section: 'settings',
bindable: true,
defaultValue: '100%',
},
placeholderText: {
label: { en: 'Placeholder Text' },
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: 'Please enter a video UUID',
}
},
triggerEvents: [
{
name: 'videoLoaded',
label: { en: 'On video loaded' },
event: { uuid: '' }
}
]
};