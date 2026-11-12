# 🛡️ AI Surveillance System — Enterprise API — Swagger API Documentation

> **API Version**: `v1.0.0`  
> **OpenAPI Version**: `3.1.0`  
> **Swagger UI Live Endpoint**: [`http://localhost:8000/docs`](http://localhost:8000/docs) (or on EC2: [`https://18.117.247.217/docs`](https://18.117.247.217/docs))  
> **ReDoc Live Endpoint**: [`http://localhost:8000/redoc`](http://localhost:8000/redoc)  
> **OpenAPI JSON Schema**: [`http://localhost:8000/openapi.json`](http://localhost:8000/openapi.json)  

---

## 📑 Table of Contents (Endpoint Categories / Tags)

- [📁 Attendance](#attendance) (7 endpoints)
- [📁 Auth](#auth) (3 endpoints)
- [📁 Cameras](#cameras) (8 endpoints)
- [📁 Detection Pipeline](#detection-pipeline) (4 endpoints)
- [📁 Detection Zones](#detection-zones) (6 endpoints)
- [📁 Employees](#employees) (7 endpoints)
- [📁 Events](#events) (10 endpoints)
- [📁 Evidence](#evidence) (4 endpoints)
- [📁 General](#general) (4 endpoints)
- [📁 Health](#health) (1 endpoints)
- [📁 Recognition History](#recognition-history) (3 endpoints)
- [📁 Rules](#rules) (5 endpoints)
- [📁 Sites](#sites) (5 endpoints)
- [📁 Tenants](#tenants) (5 endpoints)
- [📁 Vehicles / ANPR](#vehicles--anpr) (12 endpoints)

---

## 📁 Attendance

### 🟢 `GET` `/api/v1/attendance`
**Summary**: List Attendance Records

**Description**: List attendance records with optional date, employee, and search filters.
Returns employee name and ID joined from the employees table.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `skip` | `query` | No | `integer` | Records to skip for pagination |
| `limit` | `query` | No | `integer` | Max records to return |
| `date` | `query` | No | `string` | Filter by date (YYYY-MM-DD) |
| `employee_id` | `query` | No | `string` | Filter by employee string ID |
| `search` | `query` | No | `string` | Search by employee name or ID |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/attendance`
**Summary**: Create Attendance Record

**Description**: Manually create an attendance record for a registered employee.
The employee must already exist in the database (use /employees/register first).

**Request Body**:
- Content-Type: `application/json` (Schema: `AttendanceRecordCreate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/attendance/facenox-scan`
**Summary**: Scan Frame Facenox

**Description**: Real-time Facenox frame scanning with Anti-Spoofing and Automatic Attendance Tracking:
  1. Detects all faces using OpenCV YuNet FaceDetectorYN
  2. Multi-subject ByteTrack tracking
  3. Anti-Spoofing Liveness check (rejects digital photos / mobile replays)
  4. SOTA ArcFace 512-d normalized embedding extraction
  5. Vectorized Cosine Similarity matching against MySQL enrolled employees
  6. Timezone-aware (Asia/Kolkata) automatic attendance marking:
     - New check-in: creates row in attendance_records
     - Repeat observation: updates last_seen timestamp
     - Idempotent with cooldown to prevent frame spamming

**Request Body**:
- Content-Type: `application/json` (Schema: `FacenoxFrameScanRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/attendance/hardware-webcam/capture`
**Summary**: Capture Hardware Webcam

**Description**: Grab 1 single frame from local hardware webcam for enrollment in FaceRegistrationModal.

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🔵 `POST` `/api/v1/attendance/hardware-webcam/scan`
**Summary**: Scan Hardware Webcam

**Description**: Direct hardware webcam acquisition via DirectShow (Windows) / OpenCV:
Bypasses all browser permission barriers by reading directly from USB/Integrated Webcam.

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🔵 `POST` `/api/v1/attendance/punch`
**Summary**: Punch Attendance

**Description**: Direct 1-Click Punch In or Punch Out endpoint.
- punch_type='in': Records or updates entry time (first_seen)
- punch_type='out': Records or updates exit time (last_seen)

**Request Body**:
- Content-Type: `application/json` (Schema: `AttendancePunchRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/attendance/sync-hrms`
**Summary**: Sync Hrms Attendance

**Description**: Synchronize attendance records and employee roster from external HRMS:
https://hrmsapi.leanxpert.in/api/ManualAttendance

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

## 📁 Auth

### 🔵 `POST` `/api/v1/auth/access-token`
**Summary**: Login For Access Token

**Description**: OAuth2 compatible token login, get an access token for future requests.
Using email as the username.

**Request Body**:
- Content-Type: `application/x-www-form-urlencoded` (Schema: `Body_login_for_access_token_api_v1_auth_access_token_post`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/auth/token`
**Summary**: Login For Access Token

**Description**: OAuth2 compatible token login, get an access token for future requests.
Using email as the username.

**Request Body**:
- Content-Type: `application/x-www-form-urlencoded` (Schema: `Body_login_for_access_token_api_v1_auth_token_post`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/me`
**Summary**: Read Users Me

**Description**: Get current logged in user.

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

## 📁 Cameras

### 🟢 `GET` `/api/v1/cameras`
**Summary**: List Cameras

**Description**: List cameras with pagination and optional site filter.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `site_id` | `query` | No | `string` | Filter by site ID |
| `skip` | `query` | No | `integer` | - |
| `limit` | `query` | No | `integer` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/cameras`
**Summary**: Create Camera

**Description**: Create a new camera.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `X-Tenant-ID` | `header` | No | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `CameraCreate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🔴 `DELETE` `/api/v1/cameras/{camera_id}`
**Summary**: Delete Camera

**Description**: Delete a specific camera.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `camera_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `204` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/cameras/{camera_id}`
**Summary**: Get Camera

**Description**: Get a specific camera by ID.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `camera_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟣 `PATCH` `/api/v1/cameras/{camera_id}`
**Summary**: Update Camera

**Description**: Update a specific camera.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `camera_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `CameraUpdate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/cameras/{camera_id}/health`
**Summary**: Check Camera Health

**Description**: Endpoint to check camera health/latency.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `camera_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/cameras/{camera_id}/preview-token`
**Summary**: Generate Preview Token

**Description**: Mock endpoint to generate a short-lived token for WebRTC/HLS streaming.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `camera_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/cameras/{camera_id}/test`
**Summary**: Test Camera Connection

**Description**: Endpoint to start a camera stream test.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `camera_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 Detection Pipeline

### 🟢 `GET` `/api/v1/detection/cameras/{camera_id}/detections`
**Summary**: Get Camera Latest Detections

**Description**: Get the latest raw detections from the current frame of a camera.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `camera_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/detection/cameras/{camera_id}/tracks`
**Summary**: Get Camera Active Tracks

**Description**: Get all currently tracked objects for a camera with their stable track_id,
class name, confidence, normalized bbox, and duration.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `camera_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/detection/status`
**Summary**: Get Detection Status

**Description**: Get real-time pipeline health, FPS, average & P95 latency, GPU metrics,
active tracking counts, and global detection counters.

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🔵 `POST` `/api/v1/detection/webcam-detect`
**Summary**: Detect From Webcam

**Description**: Receive a base64 encoded image frame from the browser webcam
and run YOLO11m detection using the backend singleton.

**Request Body**:
- Content-Type: `application/json` (Schema: `WebcamDetectRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 Detection Zones

### 🟢 `GET` `/api/v1/zones`
**Summary**: List Zones

**Description**: List detection zones for a tenant.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `tenant_id` | `query` | ✅ Yes | `string` | Tenant ID |
| `skip` | `query` | No | `integer` | - |
| `limit` | `query` | No | `integer` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/zones`
**Summary**: Create Zone

**Description**: Create a new detection zone / ROI for a camera.

**Request Body**:
- Content-Type: `application/json` (Schema: `DetectionZoneCreate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/zones/camera/{camera_id}`
**Summary**: List Camera Zones

**Description**: Get all enabled detection zones for a camera.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `camera_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔴 `DELETE` `/api/v1/zones/{zone_id}`
**Summary**: Delete Zone

**Description**: Delete a detection zone.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `zone_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `204` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/zones/{zone_id}`
**Summary**: Get Zone

**Description**: Get a specific zone by ID.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `zone_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟣 `PATCH` `/api/v1/zones/{zone_id}`
**Summary**: Update Zone

**Description**: Update zone configuration.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `zone_id` | `path` | ✅ Yes | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `DetectionZoneUpdate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 Employees

### 🟢 `GET` `/api/v1/employees`
**Summary**: List Employees

**Description**: List all employees with optional search.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `skip` | `query` | No | `integer` | - |
| `limit` | `query` | No | `integer` | - |
| `search` | `query` | No | `string` | Search by name, ID, or department |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/employees/check-id/{employee_id}`
**Summary**: Check Employee Id

**Description**: Verify if an employee ID already exists to prevent duplicate registrations.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `employee_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/employees/facenox/enroll`
**Summary**: Enroll Employee Facenox

**Description**: Enroll or re-enroll an existing employee's face using Facenox SOTA 512-d ArcFace + YuNet model.

**Request Body**:
- Content-Type: `application/json` (Schema: `FacenoxEnrollRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/employees/recognize`
**Summary**: Recognize Employee

**Description**: Recognize an employee from a base64 encoded image or face embedding.

**Request Body**:
- Content-Type: `application/json` (Schema: `EmployeeRecognizeRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/employees/register`
**Summary**: Register Employee

**Description**: Register a new employee with a face encoding (128-d or 512-d).
Biometric templates are automatically encrypted at rest with AES-256-GCM.

**Request Body**:
- Content-Type: `application/json` (Schema: `EmployeeCreate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/employees/register-facenox`
**Summary**: Register Employee Facenox

**Description**: Workflow A: Register a new employee with Facenox SOTA biometric face enrollment.
  1. Validates that Employee ID is unique.
  2. Detects face in image with OpenCV YuNet (validates exactly 1 clear face).
  3. Verifies Anti-Spoofing liveness (rejects digital photos & replays).
  4. Extracts 512-d ArcFace normalized embedding vector.
  5. Encrypts template at rest using AES-256-GCM authenticated encryption.
  6. Persists employee profile into MySQL database.

**Request Body**:
- Content-Type: `application/json` (Schema: `FacenoxRegisterRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🔴 `DELETE` `/api/v1/employees/{employee_id}/face`
**Summary**: Remove Employee Face

**Description**: Remove an employee's face encoding while preserving the employee profile.
Allows administrators to unenroll or prepare for biometric re-enrollment.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `employee_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 Events

### 🟢 `GET` `/api/v1/events`
**Summary**: List Events

**Description**: List events ordered by observation timestamp with optional tenant scoping.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `skip` | `query` | No | `integer` | - |
| `limit` | `query` | No | `integer` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔴 `DELETE` `/api/v1/events/clear-all`
**Summary**: Clear All Events

**Description**: Clear saved object detection events scoped to tenant.
Requires authentication.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/events/detect-object`
**Summary**: Create Object Detection Event

**Description**: Save a real-time AI object detection event permanently into SQLite database.

**Request Body**:
- Content-Type: `application/json` (Schema: `ObjectDetectionRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/events/review-queue`
**Summary**: Get Review Queue

**Description**: Get all events that need review.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `limit` | `query` | No | `integer` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/events/vision-scan`
**Summary**: Vision Scan Object

**Description**: High-precision Groq AI Vision / Multimodal Object Scanner.
Inspects image frame using Groq Qwen/qwen3.6-27b Multimodal Vision model
and identifies exact objects (Computer Mouse, Pen, Phone, Laptop, Bottle, Glasses, etc.)
with 99%+ precision, bypassing background clutter (chairs, TVs, walls).

**Request Body**:
- Content-Type: `application/json` (Schema: `VisionScanRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/events/{event_id}`
**Summary**: Get Event

**Description**: Get a specific event.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `event_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/events/{event_id}/acknowledge`
**Summary**: Acknowledge Event

**Description**: Transition an event from OPEN to ACKNOWLEDGED.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `event_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `StateTransitionRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/events/{event_id}/assign`
**Summary**: Assign Event

**Description**: Transition an event from ACKNOWLEDGED to ASSIGNED.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `event_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `StateTransitionRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/events/{event_id}/close`
**Summary**: Close Event

**Description**: Transition an event to CLOSED.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `event_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `StateTransitionRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟣 `PATCH` `/api/v1/events/{event_id}/correct-label`
**Summary**: Correct Label

**Description**: Correct the label of a detection event.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `event_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `CorrectLabelRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 Evidence

### 🟢 `GET` `/api/v1/evidence`
**Summary**: List Evidence

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `search` | `query` | No | `string` | Search plate, employee, or event |
| `type_filter` | `query` | No | `string` | all, snapshot, or video |
| `camera_filter` | `query` | No | `string` | Filter by camera name |
| `date_filter` | `query` | No | `string` | YYYY-MM-DD format |
| `skip` | `query` | No | `integer` | - |
| `limit` | `query` | No | `integer` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/evidence/download/{evidence_id}`
**Summary**: Download Evidence

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `evidence_id` | `path` | ✅ Yes | `string` | - |
| `expires` | `query` | ✅ Yes | `integer` | - |
| `token` | `query` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/evidence/media/{evidence_id}`
**Summary**: View Evidence Media

**Description**: Directly serves the evidence photo/video for browser preview.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `evidence_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/evidence/signed-url/{evidence_id}`
**Summary**: Generate Download Signed Url

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `evidence_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 General

### 🟢 `GET` `/`
**Summary**: Root

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### `HEAD` `/`
**Summary**: Root

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🟢 `GET` `/health`
**Summary**: Root

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### `HEAD` `/health`
**Summary**: Root

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

## 📁 Health

### 🟢 `GET` `/api/v1/health`
**Summary**: Health Check

**Description**: Returns the health status of the API.

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

## 📁 Recognition History

### 🟢 `GET` `/api/v1/recognition-history`
**Summary**: Get Recognition History

**Description**: Retrieve filtered and paginated face recognition history logs.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `employee` | `query` | No | `string` | Search employee name or ID |
| `date` | `query` | No | `string` | Filter date in YYYY-MM-DD format |
| `camera` | `query` | No | `string` | Filter camera name |
| `status` | `query` | No | `string` | Filter by status (Recognized/Unknown) |
| `page` | `query` | No | `integer` | Page number |
| `limit` | `query` | No | `integer` | Items per page |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/recognition-history`
**Summary**: Create Recognition History Event

**Description**: Create a new face recognition history event.

**Request Body**:
- Content-Type: `application/json` (Schema: `RecognitionHistoryCreate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/recognition-history/stats`
**Summary**: Get Recognition Dashboard Stats

**Description**: Retrieve aggregated stats, chart dataset, and recent activity for the Face Recognition Dashboard.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `period` | `query` | No | `string` | Time period: today, 7days, 30days, custom |
| `start_date` | `query` | No | `string` | Start date for custom period (YYYY-MM-DD) |
| `end_date` | `query` | No | `string` | End date for custom period (YYYY-MM-DD) |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 Rules

### 🟢 `GET` `/api/v1/rules`
**Summary**: List Rules

**Description**: List rules for the tenant.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `site_id` | `query` | No | `string` | Filter by site ID |
| `skip` | `query` | No | `integer` | - |
| `limit` | `query` | No | `integer` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/rules`
**Summary**: Create Rule

**Description**: Create a new detection rule.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `X-Tenant-ID` | `header` | No | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `RuleCreate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🔴 `DELETE` `/api/v1/rules/{rule_id}`
**Summary**: Delete Rule

**Description**: Delete a rule.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `rule_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `204` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/rules/{rule_id}`
**Summary**: Get Rule

**Description**: Get a specific rule by ID.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `rule_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟣 `PATCH` `/api/v1/rules/{rule_id}`
**Summary**: Update Rule

**Description**: Update a rule.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `rule_id` | `path` | ✅ Yes | `string` | - |
| `X-Tenant-ID` | `header` | No | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `RuleUpdate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 Sites

### 🟢 `GET` `/api/v1/sites`
**Summary**: List Sites

**Description**: Retrieve a paginated list of sites. Optionally filter by tenant_id.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `skip` | `query` | No | `integer` | Number of records to skip. |
| `limit` | `query` | No | `integer` | Max records to return. |
| `tenant_id` | `query` | No | `string` | Filter by tenant UUID. |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/sites`
**Summary**: Create Site

**Description**: Register a new site under a tenant. Name must be unique within the tenant.

**Request Body**:
- Content-Type: `application/json` (Schema: `SiteCreate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🔴 `DELETE` `/api/v1/sites/{site_id}`
**Summary**: Delete Site

**Description**: Permanently delete a site by its UUID.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `site_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `204` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/sites/{site_id}`
**Summary**: Get Site

**Description**: Retrieve a single site by its UUID.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `site_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟣 `PATCH` `/api/v1/sites/{site_id}`
**Summary**: Update Site

**Description**: Partially update a site's name, timezone, or address.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `site_id` | `path` | ✅ Yes | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `SiteUpdate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 Tenants

### 🟢 `GET` `/api/v1/tenants`
**Summary**: List Tenants

**Description**: Retrieve a paginated list of all tenants.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `skip` | `query` | No | `integer` | Number of records to skip. |
| `limit` | `query` | No | `integer` | Max records to return. |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/tenants`
**Summary**: Create Tenant

**Description**: Register a new tenant. Name must be unique.

**Request Body**:
- Content-Type: `application/json` (Schema: `TenantCreate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🔴 `DELETE` `/api/v1/tenants/{tenant_id}`
**Summary**: Delete Tenant

**Description**: Permanently delete a tenant by its UUID.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `tenant_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `204` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/tenants/{tenant_id}`
**Summary**: Get Tenant

**Description**: Retrieve a single tenant by its UUID.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `tenant_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟣 `PATCH` `/api/v1/tenants/{tenant_id}`
**Summary**: Update Tenant

**Description**: Partially update a tenant's name or status.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `tenant_id` | `path` | ✅ Yes | `string` | - |

**Request Body**:
- Content-Type: `application/json` (Schema: `TenantUpdate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

## 📁 Vehicles / ANPR

### 🔴 `DELETE` `/api/v1/vehicles`
**Summary**: Clear All Vehicles

**Description**: Delete ALL vehicle records from the database.

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🟢 `GET` `/api/v1/vehicles`
**Summary**: List Vehicles

**Description**: List all scanned vehicle records with search and filtering.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `search` | `query` | No | `string` | Search by license plate number |
| `vehicle_type` | `query` | No | `string` | Filter by vehicle type (car, truck, bus, motorcycle) |
| `camera_name` | `query` | No | `string` | Filter by camera source |
| `location_spot` | `query` | No | `string` | Filter by location spot |
| `date_filter` | `query` | No | `string` | Filter by date (YYYY-MM-DD) |
| `limit` | `query` | No | `integer` | - |
| `offset` | `query` | No | `integer` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔵 `POST` `/api/v1/vehicles`
**Summary**: Create Vehicle Record

**Description**: Manually register a vehicle record in the database.

**Request Body**:
- Content-Type: `application/json` (Schema: `VehicleCreate`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `201` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/vehicles/benchmark`
**Summary**: Get Engines Benchmark

**Description**: Returns authentic benchmark comparison results comparing exact full-plate accuracy
and latency of all three engines on identical labelled Indian plate images (using persisted results if available).

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🔵 `POST` `/api/v1/vehicles/benchmark`
**Summary**: Run Engines Benchmark

**Description**: Forces live re-execution of the benchmark across all three engines on the labelled dataset.

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🟢 `GET` `/api/v1/vehicles/engines`
**Summary**: List Anpr Engines

**Description**: Returns all registered ANPR engines (Indian ANPR, FastALPR, and YOLO+EasyOCR).

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🔵 `POST` `/api/v1/vehicles/scan`
**Summary**: Scan Vehicle Plate

**Description**: Scan a car or bike number plate (via uploaded base64 image or manual input),
perform ANPR text extraction using the selected engine (indian_anpr, fast_alpr, or yolo_easyocr),
save the record permanently to the database without duplicates,
and return the scanned detection result.

**Request Body**:
- Content-Type: `application/json` (Schema: `ANPRScanRequest`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/vehicles/security/watchlist`
**Summary**: Get Watchlist

**Description**: Returns enterprise access control watchlist (BLACKLIST, RESIDENT, VIP, VISITOR).

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🔵 `POST` `/api/v1/vehicles/security/watchlist`
**Summary**: Set Watchlist Entry

**Description**: Registers or updates a vehicle plate in the enterprise access control list.

**Request Body**:
- Content-Type: `application/json` (Schema: `WatchlistEntry`)

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🔴 `DELETE` `/api/v1/vehicles/security/watchlist/{number_plate}`
**Summary**: Remove Watchlist Entry

**Description**: Removes a vehicle plate from the security watchlist.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `number_plate` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---

### 🟢 `GET` `/api/v1/vehicles/stats`
**Summary**: Get Vehicle Stats

**Description**: Get ANPR system daily statistics.

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |

---

### 🔴 `DELETE` `/api/v1/vehicles/{vehicle_id}`
**Summary**: Delete Vehicle Record

**Description**: Delete a vehicle record from the database.

**Query / Path Parameters**:
| Name | In | Required | Type | Description |
|:---|:---:|:---:|:---:|:---|
| `vehicle_id` | `path` | ✅ Yes | `string` | - |

**Responses**:
| Status Code | Description |
|:---:|:---|
| `200` | Successful Response |
| `422` | Validation Error |

---
