---
name: cookie-reader
description: A component that reads and displays cookie values, including the vkid_sdk:codeVerifier cookie.
keywords: cookies, vkid, code verifier, authentication
---

#### Cookie Reader Component

***Purpose:***
This component reads and displays cookie values from the browser, with special focus on the vkid_sdk:codeVerifier cookie which is often used in authentication flows.

***Features:***
- Reads all cookies from the browser
- Specifically extracts and displays the vkid_sdk:codeVerifier cookie value
- Updates automatically when cookies change

***Properties:***
- No configurable properties are required as the component directly reads from browser cookies

***Exposed Variables:***
- codeVerifier: The current value of the vkid_sdk:codeVerifier cookie (path: variables['current_element_uid-codeVerifier'])

***Notes:***
- This component is useful for debugging authentication flows that use the PKCE (Proof Key for Code Exchange) method
- The codeVerifier is typically used in OAuth 2.0 authorization code flow with PKCE
- The component will show nothing if the vkid_sdk:codeVerifier cookie is not present