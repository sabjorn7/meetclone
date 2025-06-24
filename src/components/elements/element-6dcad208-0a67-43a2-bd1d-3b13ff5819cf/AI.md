---
name: peertube-uploader
description: A component for uploading videos to PeerTube with resumable upload support, progress tracking, and customizable UI.
keywords: video, upload, peertube, resumable, chunk, file
---

#### PeerTube Uploader

***Purpose:***
This component enables users to upload videos to a PeerTube instance with support for resumable uploads, allowing large video files to be uploaded in chunks with the ability to pause and resume.

***Features:***
- Resumable video uploads using PeerTube's API
- Progress tracking with visual progress bar
- Customizable UI elements (labels, titles)
- Support for upload cancellation and resumption
- Chunk-based uploading to handle large files
- Comprehensive event triggers for integration with workflows

***Properties:***
- title: string - The title displayed at the top of the uploader
- showTitle: boolean - Whether to display the title
- selectFileLabel: string - Text for the file selection button
- uploadButtonLabel: string - Text for the upload button
- apiBaseUrl: string - Base URL of the PeerTube instance API
- channelId: string - ID of the PeerTube channel for uploads
- accessToken: string - Authentication token for the PeerTube API

***Events:***
- fileSelected: Triggered when a file is selected. Payload: { fileName, fileSize, fileType }
- uploadStarted: Triggered when upload begins. Payload: { uploadId }
- uploadResumed: Triggered when upload is resumed. Payload: { uploadId, startByte }
- chunkUploaded: Triggered when a chunk is uploaded. Payload: { uploadId, bytePosition, totalSize }
- uploadSuccess: Triggered when upload completes. Payload: { id, shortUUID, uuid, uploadId }
- uploadError: Triggered on upload error. Payload: { error, uploadId, bytePosition }
- uploadCancelled: Triggered when upload is cancelled. Payload: { uploadId }

***Exposed Actions:***
- `updateAccessToken`: Updates the API access token. Args: token (string)
- `updateUploadMode`: Sets upload mode to new or resume. Args: mode (string - 'new'|'resume')
- `updateResumeParams`: Sets parameters for resuming an upload. Args: uploadId (string), chunkPosition (number)
- `cancelUpload`: Cancels the current upload process.

***Exposed Variables:***
- accessToken: The current access token for PeerTube API. (path: variables['current_element_uid-accessToken'])
- uploadMode: Current upload mode ('new' or 'resume'). (path: variables['current_element_uid-uploadMode'])
- uploadIdResume: Upload ID for resuming an upload. (path: variables['current_element_uid-uploadIdResume'])
- chunkResume: Byte position to resume from. (path: variables['current_element_uid-chunkResume'])
- currentChunk: Current byte position during upload. (path: variables['current_element_uid-currentChunk'])
- fileName: Name of the selected file. (path: variables['current_element_uid-fileName'])

***Notes:***
- Only MP4 video files are supported
- The component requires a valid PeerTube access token to function
- For resumable uploads, both uploadIdResume and chunkResume must be set
- The component handles chunking automatically (5MB chunks by default)