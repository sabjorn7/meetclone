export default {
editor: {
label: {
en: 'Text Diff Comparison',
},
icon: 'code',
},
properties: {
oldText: {
label: { en: 'Old Text' },
type: 'Textarea',
section: 'settings',
bindable: true,
defaultValue: 'This is the old version of the text.',
},
newText: {
label: { en: 'New Text' },
type: 'Textarea',
section: 'settings',
bindable: true,
defaultValue: 'This is the new version of the text with some changes.',
},
oldVersionTitle: {
label: { en: 'Old Version Title' },
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: 'Old Version',
},
newVersionTitle: {
label: { en: 'New Version Title' },
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: 'New Version',
},
diffMode: {
label: { en: 'Diff Mode' },
type: 'TextSelect',
section: 'settings',
bindable: true,
defaultValue: 'words',
options: {
options: [
{ value: 'words', label: 'Words' },
{ value: 'chars', label: 'Characters' },
{ value: 'lines', label: 'Lines' }
]
},
},
showLineNumbers: {
label: { en: 'Show Line Numbers' },
type: 'OnOff',
section: 'settings',
bindable: true,
defaultValue: false,
},
deletedTextColor: {
label: { en: 'Deleted Text Color' },
type: 'Color',
section: 'style',
bindable: true,
defaultValue: '#d32f2f',
},
addedTextColor: {
label: { en: 'Added Text Color' },
type: 'Color',
section: 'style',
bindable: true,
defaultValue: '#388e3c',
}
}
};