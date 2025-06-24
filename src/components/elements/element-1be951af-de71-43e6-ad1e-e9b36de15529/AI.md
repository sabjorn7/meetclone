---
name: meetgu-video-player
description: A component that embeds Meetgu videos using iframe with customizable UUID parameter
keywords:
- video
- iframe
- meetgu
- embed
- player
- expression
---

#### meetgu-video-player

***Purpose:***
Embeds Meetgu videos using an iframe where the video UUID can be dynamically provided, including through expression components.

***Features:***
- Customizable video UUID for dynamic video loading
- Support for expression components to provide the UUID
- Responsive design with configurable aspect ratio
- Placeholder display when no UUID is provided
- Video loaded event trigger

***Properties:***
- videoUuid: string - The UUID of the video to display (e.g., "my_uuid"). Can be provided through an expression component.
- title: string - The title attribute for the iframe element
- aspectRatio: '16/9'|'4/3'|'1/1'|'9/16' - The aspect ratio of the video player
- maxWidth: string - The maximum width of the video player (e.g., "100%", "500px")
- placeholderText: string - Text to display when no video UUID is provided

***Events:***
- videoLoaded: Triggered when the video iframe has loaded. Payload: { "uuid": "current_video_uuid" }

***Exposed Variables:***
- isLoaded: Boolean indicating if the video has loaded. (path: variables['current_element_uid-isLoaded'])

***Notes:***
- The video is embedded using an iframe with sandbox attributes for security
- The component maintains aspect ratio regardless of container size
- A placeholder is shown when no UUID is provided
- UUID can be dynamically provided through expression components
- The component handles type checking to ensure proper rendering with different input types