# Azure New Implementation Requirements Specification - Transcript Minute Application

## 1. Application Overview

### 1.1 Basic Features

**Transcript Minute** is a web application that uploads audio and video files and uses AI to automate the following processes:

- **Audio and Video File Upload**: Supports multiple formats (MP3, M4A, WAV, MP4, OGG, AAC, WEBM, FLAC)
- **Multilingual Transcription**: Transcription in Japanese and English
- **Speaker Recognition and Editing**: Automatic speaker identification using AI and manual name editing
- **Bullet List Generation**: Extraction of key points from transcripts
- **Meeting Minute Generation**: Automatic generation of structured meeting minutes
- **Task List Generation**: Extraction of tasks from meeting minutes
- **Bulk Download**: Provides results as a ZIP file
- **Real-Time Processing Status Updates**: Real-time processing progress notifications

### 1.2 Non-Functional Requirements

- **Maintenance Mode**: Suspending all functionality via environment variables
- **Version Management**: Displaying application versions and update history
- **Multi-Environment Support**: Separating development, demo, and production environments
- **Security**: Proper permission management and secure management of API keys

## 2. User Management and Authentication Requirements

### 2.1 User Authentication

- **Authentication Method**: Email Address + Password
- **Social Login**: Implement as needed
- **Password Reset**: Email-based password reset function
- **Two-Factor Authentication**: Considering future implementation

### 2.2 Organization and User Management

- **Organization Management**:
- Organization Name
- Remaining Time (Minutes)
- Multiple User Affiliations

- **User Management**:
- User Name
- Email Address
- Organization Affiliation
- Administrative Privileges
- Cognito Sub (for authentication system integration)

### 2.3 Authorization and Access Control

- Organization-Based Access Control: Users can only access data from their own organization.
- Processing Session Ownership: Users can only access the processing results of files they uploaded.
- Administrator Permissions: Administrative permissions for all organizations and users.

## 4. Processing Flow Requirements

### 4.1 Transcription Processing Flow

1. File Upload:

- Upload a file to cloud storage from the front end.
- Create a ProcessingSession record (status: UPLOADED).

2. Transcription Processing:

- File upload triggers backend processing.
- Calls an external API (Azure OpenAI Service) to perform transcription.
- Saves the results to output storage.
- Updates the ProcessingSession status (PROCESSING_TRANSCRIPTION → PENDING_SPEAKER_EDIT).

3. Speaker Edit:

- User edits the speaker name.
- Updates the status after editing is complete (SPEAKER_EDIT_COMPLETED).

### 4.2 Content Generation Process Flow

1. **Generation Request**:

- Call the generation API from the frontend
- Specify the content type to generate (bullets, minutes, tasks)

2. **Asynchronous Processing**:

- The endpoint function receives the request
- Call the worker function asynchronously
- Immediately return an "Accepted" response

3. **Background Processing**:

- The worker function calls an external API (Azure OpenAI Service)
- Updates the processing status for each content type
- Saves the results to the output storage

### 4.3 Real-Time Updates

- **Processing Status Change Notification**: Notifies the frontend of backend processing status changes in real time
- **Subscription Management**: Monitors status changes for each processing session

### 5. File Storage Requirements

### 5.1 Input Files

- **Private Access**: Only the user can access the user's files
- **Hierarchical Structure**: `private/{identityId}/{sessionId}/{fileName}`
- **Supported Formats**: MP3, M4A, WAV, MP4, OGG, AAC, WEBM, FLAC
- **Upload Limits**: File size and usage time limits

### 5.2 Output Files

- **Processing Result Storage**: Transcription, Listings, Meeting Notes, and Task Results
- **JSON Format**: Structured Data Storage
- **Private Access**: Accessible only to the process executor
- **Hierarchical Structure**: `private/{identityId}/{sessionId}/{fileType}_{fileName}.{ext}`

### 5.3 Temporary Files

- **Signed URL**: Generate a temporary file access URL for external APIs
- **Expiration Date**: Set an appropriate expiration date

## 6. External API Integration Requirements

### 6.1 Azure OpenAI Service

- **Applications**:
- **Speech Recognition and Transcription**: Uses the Whisper model
- **Bullet Points, Meeting Minutes, and Task Generation**: Uses the GPT model
- **Configuration Items**:
- API Key
- Endpoint URL
- Deployment Name (Model)

### 6.2 API Key Management

- **Secure Storage**: Secure storage in a confidential information management service such as Azure Key Vault
- **Environment Isolation**: Isolate API keys between development and production environments
- **Access Control**: Only necessary functions can access API keys

## 7. API Specification Requirements

### 7.1 GraphQL API

- **Data Access**: CRUD operations for Organization, User, and ProcessingSession
- **Real-Time Updates**: Notification of ProcessingSession state changes
- **Authentication**: JWT token-based authentication
- **Authorization**: Organization- and owner-based access control

### 7.2 REST API

- **Generation Processing Endpoint**:
- `POST /generate/process-all`
- Request: sessionId, transcript, processingTypes
- Response: 202 Accepted (Asynchronous Processing)

#### 7.3 Backend Function Specifications

#### 7.3.1 Transcription Processing Function

- **Trigger**: File Upload
- **Process**: External API Call, Result Storing, Status Update
- **Error Handling**: Status Update in Case of Failure

#### 7.3.2 Generation Processing Endpoint Function

- **Trigger**: HTTP Request
- **Process**: Request Validation, Worker Function Call
- **Response**: Immediate Acceptance Response

#### 7.3.3 Generation Processing Worker Function

- **Trigger**: Call from Endpoint Function
- **Process**: Generate Each Content Type, Status Update
- **Parallel Processing**: Parallel Generation of Multiple Content Types

## 8. Frontend Requirements

### 8.1 Technology Stack

- **Framework**: React (Next.js)
- **Language**: TypeScript
- **Styling**: CSS Modules
- **State Management**: React Hooks

### 8.2 Main Components

- **MediaUploader**: File upload, language selection
- **TranscriptionResult**: Result display, speaker editing
- **SpeakerNameEditor**: Speaker name editing
- **ProgressIndicator**: Processing progress display
- **VersionHistoryModal**: Update history display

### 8.3 Functional Requirements

- **Drag & Drop**: File upload
- **Real-time Update**: Automatic update of processing status
- **Bulk Download**: Results obtained in ZIP format
- **Speaker Editing**: Interactive editing
- **Responsive Design**: Mobile compatibility
- **Dark Mode**: Display switching according to system settings

## 9. Environment and Configuration Requirements

### 9.1 Environment Variables

```bash
# Basic Settings
NEXT_PUBLIC_APP_ENV=development|demo|production
# → Change variable names to assume Azure
AZURE_LOCATION=japaneast

# Authentication Settings
# → Assume Azure AD B2C / Entra ID
AZURE_AD_B2C_TENANT_NAME=...
AZURE_AD_B2C_CLIENT_ID=...
AZURE_AD_B2C_USER_FLOW=...

# Storage Settings
# → Assume Azure Blob Storage
STORAGE_ACCOUNT_NAME=...
STORAGE_CONTAINER_NAME=...

# API Settings
# → Assume Azure OpenAI / Key Vault
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_KEY_VAULT_URI=https://your-vault-name.vault.azure.net/

# Feature Control
# → Changed variable names to framework-independent ones.
MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE=Maintenance in progress
USE_MOCK_DATA=false
```

### 9.2 Development Environment Configuration

- **Mock Data**: Disable API requests during development
- **Hot Reload**: Automatic updates during development
- **Environment Switching**: Easily switch between development, demo, and production environments

## 10. Security Requirements

### 10.1 Authentication and Authorization

- **JWT Token**: Expiry token
- **Refresh Token**: Automatic token refresh
- **Session Management**: Proper session management

### 10.2 Data Protection

- **Encryption**: Encrypt data at rest
- **Access Control**: Principle of least privilege
- **Audit Logging**: Record access logs

### 10.3 API Security

- **Rate Limiting**: API call limits
- **Input Validation**: Validate all input data
- **CORS Settings**: Ensure proper CORS settings

### 11. Monitoring and Logging Requirements

### 11.1 Application Monitoring

- **Performance Monitoring**: Response time, error rate
- **Availability Monitoring**: Service status
- **Resource Monitoring**: CPU, memory, and storage utilization

### 11.2 Log Management

**Application Log**: Errors, access, and processing status

- **Audit Log**: User operations and data access
- **Log Level**: DEBUG, INFO, WARN, ERROR

### 11.3 Alert Settings

- **Error Alert**: Notification of processing failures
- **Performance Alert**: Notification of performance degradation
- **Capacity Alert**: Storage capacity monitoring

## 12. Operational Requirements

### 12.1 Deployment

- **CI/CD**: Automated deployment
- **Environment Separation**: Separation of development, test, and production environments
- **Rollback**: Quick rollback to previous versions

### 12.2 Backup and Disaster Recovery

- **Data Backup**: Regular data backups
- **Recovery Procedure**: Disaster recovery procedures
- **RPO/RTO**: Recovery time and recovery point objectives

### 12.3 Scalability

- **Horizontal Scaling**: Scaling according to load
- **Vertical Scaling**: Responding to resource fluctuations
- **Load Balancing**: Appropriate load balancing

## 14. Future Scalability

### 14.1 Functionality Expansion

- **Multilingual Support**: Adding supported languages
- **AI Functionality Expansion**: Adding new AI functions
- **Integration Functions**: Integration with other systems

### 14.2 Technical Expansion

- **Microservices**: Service separation
- **API Expansion**: External integration API
- **Platform Expansion**: Mobile app support

Based on this requirements specification, you can appropriately select Azure services and develop an implementation plan.

---

## Reference Information: Data Model (Draft)

_The following data model is for an existing system. It is not necessary to strictly follow this configuration when implementing on Azure. Please use it as a design reference. _

### Organization

```typescript
interface Organization {
  id: string;
  name: string;
  remainingMinutes: number;
  users: User[];
  createdAt: string;
  updatedAt: string;
}
```

### User

```typescript
interface User {
  id: string;
  organizationID: string;
  username: string;
  email: string;
  cognitoSub: string;
  isAdmin: boolean;
  organization: Organization;
  createdAt: string;
  updatedAt: string;
}
```

### ProcessingSession

```typescript
interface ProcessingSession {
  id: string;
  owner: string;
  identityId: string;
  sessionId: string;
  organizationID: string;
  fileName: string;
  language: string;
  status: ProcessingStatus;
  uploadTime: string;
  transcriptKey?: string;
  bulletPointsKey?: string;
  minutesKey?: string;
  taskFileKey?: string;
  informationFileKey?: string;
  tasksKey?: string;
  processingTypes: string[];
  audioLengthSeconds?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
```

### ProcessingStatus

```typescript
enum ProcessingStatus {
  UPLOADED = "UPLOADED",
  PROCESSING_TRANSCRIPTION = "PROCESSING_TRANSCRIPTION",
  TRANSCRIPTION_FAILED = "TRANSCRIPTION_FAILED",
  PENDING_SPEAKER_EDIT = "PENDING_SPEAKER_EDIT",
  SPEAKER_EDIT_COMPLETED = "SPEAKER_EDIT_COMPLETED",
  PROCESSING_BULLETS = "PROCESSING_BULLETS",
  BULLETS_COMPLETED = "BULLETS_COMPLETED",
  BULLETS_FAILED = "BULLETS_FAILED",
  PROCESSING_MINUTES = "PROCESSING_MINUTES",
  MINUTES_COMPLETED = "MINUTES_COMPLETED",
  MINUTES_FAILED = "MINUTES_FAILED",
  PROCESSING_TASKS = "PROCESSING_TASKS",
  TASKS_COMPLETED = "TASKS_COMPLETED",
  TASKS_FAILED = "TASKS_FAILED",
  ALL_COMPLETED = "ALL_COMPLETED",
  ERROR = "ERROR",
}
```
