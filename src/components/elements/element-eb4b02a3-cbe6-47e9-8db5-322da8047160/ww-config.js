export default {
    editor: {
        label: {
            en: 'VK Auth & Telegram WebApp',
            ru: 'Авторизация ВК и Telegram WebApp'
        },
        icon: 'login',
    },
    properties: {
        appId: {
            label: {
                en: 'VK App ID',
                ru: 'ID приложения ВК'
            },
            type: 'Text',
            section: 'settings',
            bindable: true,
            defaultValue: '',
        },
        appSetupInfo: {
            label: {
                en: 'VK App Setup Info',
                ru: 'Информация о настройке приложения ВК'
            },
            type: 'Info',
            section: 'settings',
            options: {
                text: 'Important: Your VK application must be properly configured in the VK Developer Dashboard. For OAuth flow, ensure your app has "Open API" enabled and the redirect URI is whitelisted. For VK ID One Tap, your app must have "VK ID" integration enabled with the latest SDK version.'
            },
        },
        redirectUri: {
            label: {
                en: 'Redirect URI',
                ru: 'URI перенаправления'
            },
            type: 'Text',
            section: 'settings',
            bindable: true,
            defaultValue: '',
        },
        scopes: {
            label: {
                en: 'Scopes',
                ru: 'Разрешения'
            },
            type: 'Text',
            section: 'settings',
            bindable: true,
            defaultValue: 'email',
        },
        authMethod: {
            label: {
                en: 'Auth Method',
                ru: 'Метод авторизации'
            },
            type: 'TextSelect',
            section: 'settings',
            bindable: true,
            defaultValue: 'oauth',
            options: {
                options: [
                    { value: 'oauth', label: 'OAuth 2.0 (Redirect)' },
                    { value: 'onetap', label: 'VK ID One Tap' },
                ]
            },
        },
        state: {
            label: {
                en: 'State Parameter',
                ru: 'Параметр state'
            },
            type: 'Text',
            section: 'settings',
            bindable: true,
            defaultValue: '',
        },
        cleanUrlAfterAuth: {
            label: {
                en: 'Clean URL After Auth',
                ru: 'Очистить URL после авторизации'
            },
            type: 'OnOff',
            section: 'settings',
            bindable: true,
            defaultValue: true,
        },
        buttonText: {
            label: {
                en: 'Button Text',
                ru: 'Текст кнопки'
            },
            type: 'Text',
            section: 'style',
            bindable: true,
            defaultValue: 'Sign in with VK',
            hidden: content => content.authMethod === 'onetap',
        },
        hideIcon: {
            label: {
                en: 'Hide VK Icon',
                ru: 'Скрыть иконку ВК'
            },
            type: 'OnOff',
            section: 'style',
            bindable: true,
            defaultValue: false,
            hidden: content => content.authMethod === 'onetap',
        },
        buttonColor: {
            label: {
                en: 'Button Color',
                ru: 'Цвет кнопки'
            },
            type: 'Color',
            section: 'style',
            bindable: true,
            defaultValue: '#0077FF',
            hidden: content => content.authMethod === 'onetap',
        },
        buttonTextColor: {
            label: {
                en: 'Button Text Color',
                ru: 'Цвет текста кнопки'
            },
            type: 'Color',
            section: 'style',
            bindable: true,
            defaultValue: '#FFFFFF',
            hidden: content => content.authMethod === 'onetap',
        },
        buttonBorderRadius: {
            label: {
                en: 'Button Border Radius',
                ru: 'Радиус скругления кнопки'
            },
            type: 'Length',
            section: 'style',
            bindable: true,
            defaultValue: '4px',
            hidden: content => content.authMethod === 'onetap',
        },
        buttonPadding: {
            label: {
                en: 'Button Padding',
                ru: 'Внутренний отступ кнопки'
            },
            type: 'Text',
            section: 'style',
            bindable: true,
            defaultValue: '10px 16px',
            hidden: content => content.authMethod === 'onetap',
        },
        buttonFontSize: {
            label: {
                en: 'Button Font Size',
                ru: 'Размер шрифта кнопки'
            },
            type: 'Length',
            section: 'style',
            bindable: true,
            defaultValue: '14px',
            hidden: content => content.authMethod === 'onetap',
        },
        buttonFontWeight: {
            label: {
                en: 'Button Font Weight',
                ru: 'Толщина шрифта кнопки'
            },
            type: 'TextSelect',
            section: 'style',
            bindable: true,
            defaultValue: '500',
            options: {
                options: [
                    { value: '300', label: 'Light' },
                    { value: '400', label: 'Regular' },
                    { value: '500', label: 'Medium' },
                    { value: '600', label: 'Semi Bold' },
                    { value: '700', label: 'Bold' },
                ]
            },
            hidden: content => content.authMethod === 'onetap',
        },
        buttonBorder: {
            label: {
                en: 'Button Border',
                ru: 'Граница кнопки'
            },
            type: 'Text',
            section: 'style',
            bindable: true,
            defaultValue: 'none',
            hidden: content => content.authMethod === 'onetap',
        },
        oneTapButtonSkin: {
            label: {
                en: 'One Tap Button Skin',
                ru: 'Стиль кнопки One Tap'
            },
            type: 'TextSelect',
            section: 'style',
            bindable: true,
            defaultValue: 'primary',
            options: {
                options: [
                    { value: 'primary', label: 'Primary' },
                    { value: 'flat', label: 'Flat' },
                ]
            },
            hidden: content => content.authMethod !== 'onetap',
        },
        oneTapButtonSize: {
            label: {
                en: 'One Tap Button Size',
                ru: 'Размер кнопки One Tap'
            },
            type: 'TextSelect',
            section: 'style',
            bindable: true,
            defaultValue: 'large',
            options: {
                options: [
                    { value: 'large', label: 'Large' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'small', label: 'Small' },
                ]
            },
            hidden: content => content.authMethod !== 'onetap',
        },
        showAgreements: {
            label: {
                en: 'Show Agreements',
                ru: 'Показывать соглашения'
            },
            type: 'OnOff',
            section: 'settings',
            bindable: true,
            defaultValue: true,
            hidden: content => content.authMethod !== 'onetap',
        },
        showAlternativeLogin: {
            label: {
                en: 'Show Alternative Login',
                ru: 'Показывать альтернативный вход'
            },
            type: 'OnOff',
            section: 'settings',
            bindable: true,
            defaultValue: true,
            hidden: content => content.authMethod !== 'onetap',
        },
        backendTokenExchange: {
            label: {
                en: 'Backend token exchange',
                ru: 'Обмен токенов на бэкенде'
            },
            type: 'OnOff',
            section: 'settings',
            bindable: true,
            defaultValue: false,
            hidden: content => content.authMethod !== 'onetap',
        },
        // Telegram WebApp settings
        telegramSection: {
            label: {
                en: 'Telegram WebApp',
                ru: 'Telegram WebApp'
            },
            type: 'Section',
            section: 'settings',
        },
        showTelegramInfo: {
            label: {
                en: 'Show Telegram Info',
                ru: 'Показать информацию Telegram'
            },
            type: 'OnOff',
            section: 'settings',
            bindable: true,
            defaultValue: false,
        },
        telegramInfoText: {
            label: {
                en: 'Telegram WebApp Info',
                ru: 'Информация о Telegram WebApp'
            },
            type: 'Info',
            section: 'settings',
            options: {
                text: 'This component automatically detects if it\'s running inside a Telegram Mini App and exposes all Telegram WebApp data as internal variables. You can access these variables in your WeWeb project and use them to adapt your UI to the Telegram environment.'
            },
        },
    },
    triggerEvents: [
        {
            name: 'success',
            label: {
                en: 'On Auth Success',
                ru: 'При успешной авторизации'
            },
            event: {
                code: '',
                device_id: '',
                code_verifier: ''
            }
        },
        {
            name: 'error',
            label: {
                en: 'On Auth Error',
                ru: 'При ошибке авторизации'
            },
            event: {
                error: ''
            }
        },
        // Telegram WebApp events
        {
            name: 'telegramWebAppReady',
            label: {
                en: 'On Telegram WebApp Ready',
                ru: 'При готовности Telegram WebApp'
            },
            event: {
                platform: '',
                version: ''
            }
        },
        {
            name: 'telegramViewportChanged',
            label: {
                en: 'On Telegram Viewport Changed',
                ru: 'При изменении области просмотра Telegram'
            },
            event: {
                viewportHeight: 0,
                isExpanded: false,
                safeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 }
            }
        },
        {
            name: 'telegramThemeChanged',
            label: {
                en: 'On Telegram Theme Changed',
                ru: 'При изменении темы Telegram'
            },
            event: {
                colorScheme: '',
                themeParams: {}
            }
        },
        {
            name: 'telegramMainButtonClicked',
            label: {
                en: 'On Telegram Main Button Clicked',
                ru: 'При нажатии на главную кнопку Telegram'
            },
            event: {}
        },
        {
            name: 'telegramBackButtonClicked',
            label: {
                en: 'On Telegram Back Button Clicked',
                ru: 'При нажатии на кнопку назад Telegram'
            },
            event: {}
        },
        {
            name: 'telegramSettingsButtonClicked',
            label: {
                en: 'On Telegram Settings Button Clicked',
                ru: 'При нажатии на кнопку настроек Telegram'
            },
            event: {}
        },
        {
            name: 'telegramPopupClosed',
            label: {
                en: 'On Telegram Popup Closed',
                ru: 'При закрытии всплывающего окна Telegram'
            },
            event: {
                buttonId: ''
            }
        },
        {
            name: 'telegramAlertClosed',
            label: {
                en: 'On Telegram Alert Closed',
                ru: 'При закрытии оповещения Telegram'
            },
            event: {}
        },
        {
            name: 'telegramConfirmClosed',
            label: {
                en: 'On Telegram Confirm Closed',
                ru: 'При закрытии подтверждения Telegram'
            },
            event: {
                confirmed: false
            }
        },
        {
            name: 'telegramQrTextReceived',
            label: {
                en: 'On Telegram QR Text Received',
                ru: 'При получении текста QR-кода Telegram'
            },
            event: {
                text: ''
            }
        },
        {
            name: 'telegramClipboardTextReceived',
            label: {
                en: 'On Telegram Clipboard Text Received',
                ru: 'При получении текста из буфера обмена Telegram'
            },
            event: {
                text: ''
            }
        },
        {
            name: 'telegramInvoiceClosed',
            label: {
                en: 'On Telegram Invoice Closed',
                ru: 'При закрытии счета Telegram'
            },
            event: {
                status: ''
            }
        }
    ],
    actions: [
        // Telegram WebApp actions
        {
            action: 'telegramExpandApp',
            label: {
                en: 'Expand Telegram WebApp',
                ru: 'Развернуть Telegram WebApp'
            }
        },
        {
            action: 'telegramCloseApp',
            label: {
                en: 'Close Telegram WebApp',
                ru: 'Закрыть Telegram WebApp'
            }
        },
        {
            action: 'telegramSetupMainButton',
            label: {
                en: 'Setup Telegram Main Button',
                ru: 'Настроить главную кнопку Telegram'
            },
            args: [
                {
                    name: 'params',
                    type: 'object',
                    label: {
                        en: 'Button Parameters',
                        ru: 'Параметры кнопки'
                    }
                }
            ]
        },
        {
            action: 'telegramSetupBackButton',
            label: {
                en: 'Setup Telegram Back Button',
                ru: 'Настроить кнопку назад Telegram'
            },
            args: [
                {
                    name: 'isVisible',
                    type: 'boolean',
                    label: {
                        en: 'Is Visible',
                        ru: 'Видимость'
                    }
                }
            ]
        },
        {
            action: 'telegramShowPopup',
            label: {
                en: 'Show Telegram Popup',
                ru: 'Показать всплывающее окно Telegram'
            },
            args: [
                {
                    name: 'params',
                    type: 'object',
                    label: {
                        en: 'Popup Parameters',
                        ru: 'Параметры всплывающего окна'
                    }
                }
            ]
        },
        {
            action: 'telegramShowAlert',
            label: {
                en: 'Show Telegram Alert',
                ru: 'Показать оповещение Telegram'
            },
            args: [
                {
                    name: 'message',
                    type: 'string',
                    label: {
                        en: 'Message',
                        ru: 'Сообщение'
                    }
                }
            ]
        },
        {
            action: 'telegramShowConfirm',
            label: {
                en: 'Show Telegram Confirm',
                ru: 'Показать подтверждение Telegram'
            },
            args: [
                {
                    name: 'message',
                    type: 'string',
                    label: {
                        en: 'Message',
                        ru: 'Сообщение'
                    }
                }
            ]
        },
        {
            action: 'telegramScanQrCode',
            label: {
                en: 'Scan QR Code',
                ru: 'Сканировать QR-код'
            }
        },
        {
            action: 'telegramReadClipboard',
            label: {
                en: 'Read Clipboard',
                ru: 'Прочитать буфер обмена'
            }
        }
    ],
};